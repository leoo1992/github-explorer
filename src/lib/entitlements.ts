import { createAdminClient } from '@/lib/supabase/admin';

export type UserEntitlement = {
  admin_free_until: string | null;
  free_analysis_claimed_at: string | null;
  free_analysis_used_at: string | null;
};

const CLAIM_STALE_MINUTES = 15;

export async function getUserEntitlement(userId: string): Promise<UserEntitlement | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_entitlements')
    .select('admin_free_until, free_analysis_claimed_at, free_analysis_used_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível validar o acesso gratuito: ${error.message}`);
  return data as UserEntitlement | null;
}

export function freeGrantDaysRemaining(freeUntil: string | null) {
  if (!freeUntil) return 0;
  const remainingMs = new Date(freeUntil).getTime() - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

export async function claimFreeAnalysis(userId: string) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MINUTES * 60 * 1000).toISOString();

  const { error: ensureError } = await supabase
    .from('user_entitlements')
    .upsert(
      { user_id: userId, updated_at: now },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (ensureError) throw new Error(`Não foi possível preparar a análise gratuita: ${ensureError.message}`);

  const { data, error } = await supabase
    .from('user_entitlements')
    .update({
      free_analysis_claimed_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
    .is('free_analysis_used_at', null)
    .or(`free_analysis_claimed_at.is.null,free_analysis_claimed_at.lt.${staleBefore}`)
    .select('user_id')
    .maybeSingle();

  if (error) throw new Error(`Não foi possível reservar a análise gratuita: ${error.message}`);
  return Boolean(data);
}

export async function completeFreeAnalysis(userId: string) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('user_entitlements')
    .update({
      free_analysis_used_at: now,
      free_analysis_claimed_at: null,
      updated_at: now,
    })
    .eq('user_id', userId)
    .is('free_analysis_used_at', null);

  if (error) throw new Error(`Não foi possível concluir a análise gratuita: ${error.message}`);
}

export async function releaseFreeAnalysisClaim(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('user_entitlements')
    .update({
      free_analysis_claimed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .is('free_analysis_used_at', null);

  if (error) console.error('[entitlements] failed to release free analysis claim', error.message);
}

export async function grantThirtyFreeDays(userId: string) {
  const supabase = createAdminClient();
  const now = new Date();
  const freeUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('user_entitlements')
    .upsert(
      {
        user_id: userId,
        admin_free_until: freeUntil,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('admin_free_until')
    .single();

  if (error) throw new Error(`Não foi possível conceder os 30 dias grátis: ${error.message}`);
  return data.admin_free_until as string;
}
