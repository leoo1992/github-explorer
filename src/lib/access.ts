import type { User } from '@supabase/supabase-js';
import { isCanonicalAdmin } from '@/lib/admin-role';
import { freeGrantDaysRemaining, getUserEntitlement } from '@/lib/entitlements';
import { isEmailVerifiedForAccess } from '@/lib/email-verification';
import { createClient } from '@/lib/supabase/server';

export type SubscriptionState = {
  status: string;
  price_id: string | null;
  current_period_end: string | null;
} | null;

export type AccessState = {
  user: User | null;
  paid: boolean;
  admin: boolean;
  subscription: SubscriptionState;
  freeGrantUntil: string | null;
  freeGrantActive: boolean;
  freeGrantDaysRemaining: number;
  freeAnalysisAvailable: boolean;
  canAnalyze: boolean;
  historyEnabled: boolean;
};

const PAID_STATUSES = new Set(['active', 'trialing']);

function emptyAccess(): AccessState {
  return {
    user: null,
    paid: false,
    admin: false,
    subscription: null,
    freeGrantUntil: null,
    freeGrantActive: false,
    freeGrantDaysRemaining: 0,
    freeAnalysisAvailable: false,
    canAnalyze: false,
    historyEnabled: false,
  };
}

export async function getAccessState(): Promise<AccessState> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user || !isEmailVerifiedForAccess(userData.user)) {
    return emptyAccess();
  }

  const [{ data: subscription, error: subscriptionError }, entitlement] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, price_id, current_period_end')
      .eq('user_id', userData.user.id)
      .maybeSingle(),
    getUserEntitlement(userData.user.id),
  ]);

  if (subscriptionError) {
    throw new Error(`Não foi possível validar a assinatura: ${subscriptionError.message}`);
  }

  const admin = isCanonicalAdmin(userData.user);
  const paid = admin || Boolean(subscription && PAID_STATUSES.has(subscription.status));
  const freeGrantUntil = entitlement?.admin_free_until ?? null;
  const remainingDays = freeGrantDaysRemaining(freeGrantUntil);
  const freeGrantActive = !admin && !paid && remainingDays > 0;
  const freeAnalysisAvailable = !admin && !paid && !freeGrantActive && !entitlement?.free_analysis_used_at;
  const canAnalyze = admin || paid || freeGrantActive || freeAnalysisAvailable;
  const historyEnabled = admin || paid || freeGrantActive;

  return {
    user: userData.user,
    admin,
    paid,
    subscription,
    freeGrantUntil,
    freeGrantActive,
    freeGrantDaysRemaining: remainingDays,
    freeAnalysisAvailable,
    canAnalyze,
    historyEnabled,
  };
}

export async function requireAnalysisApiAccess() {
  try {
    const access = await getAccessState();
    if (!access.user) {
      return {
        access: null,
        response: Response.json(
          { error: 'Faça login para continuar.', code: 'AUTH_REQUIRED' },
          { status: 401, headers: { 'cache-control': 'private, no-store' } },
        ),
      };
    }

    if (!access.canAnalyze) {
      return {
        access: null,
        response: Response.json(
          { error: 'Seu acesso gratuito foi utilizado. Ative o plano para continuar.', code: 'PAYMENT_REQUIRED' },
          { status: 402, headers: { 'cache-control': 'private, no-store' } },
        ),
      };
    }

    return { access, response: null };
  } catch (error) {
    return {
      access: null,
      response: Response.json(
        {
          error: error instanceof Error ? error.message : 'Não foi possível validar o acesso.',
          code: 'ACCESS_CHECK_FAILED',
        },
        { status: 503, headers: { 'cache-control': 'private, no-store' } },
      ),
    };
  }
}
