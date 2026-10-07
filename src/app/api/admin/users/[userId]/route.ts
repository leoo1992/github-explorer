import { NextRequest } from 'next/server';
import { getAccessState } from '@/lib/access';
import { isCanonicalAdmin } from '@/lib/admin-role';
import { grantThirtyFreeDays } from '@/lib/entitlements';
import { createStripeClient } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const access = await getAccessState();
  return access.user && access.admin ? access : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const access = await requireAdmin();
  if (!access) {
    return Response.json({ error: 'Acesso administrativo necessário.' }, { status: 403 });
  }

  const { userId } = await context.params;
  const body = await request.json().catch(() => ({})) as { action?: string };

  if (body.action !== 'grant_30_days') {
    return Response.json({ error: 'Ação administrativa inválida.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return Response.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  if (isCanonicalAdmin(data.user)) {
    return Response.json({ error: 'A conta administrativa já possui acesso permanente.' }, { status: 400 });
  }

  const freeUntil = await grantThirtyFreeDays(userId);
  return Response.json({ ok: true, freeUntil });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const access = await requireAdmin();
  if (!access) {
    return Response.json({ error: 'Acesso administrativo necessário.' }, { status: 403 });
  }

  const { userId } = await context.params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    return Response.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  if (isCanonicalAdmin(data.user)) {
    return Response.json({ error: 'A conta administrativa principal não pode ser removida.' }, { status: 400 });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id,status')
    .eq('user_id', userId)
    .maybeSingle();

  if (subscriptionError) {
    return Response.json({ error: 'Não foi possível validar a assinatura do usuário.' }, { status: 503 });
  }

  const subscriptionId = subscription?.stripe_subscription_id as string | null | undefined;
  if (
    subscriptionId &&
    subscriptionId !== 'internal_admin' &&
    subscription?.status !== 'canceled' &&
    subscription?.status !== 'incomplete_expired'
  ) {
    try {
      const stripe = createStripeClient();
      await stripe.subscriptions.cancel(subscriptionId);
    } catch {
      return Response.json(
        { error: 'Não foi possível cancelar a assinatura antes da remoção. Tente novamente.' },
        { status: 502 },
      );
    }
  }

  const { error: revokeError } = await supabase.rpc('admin_revoke_user_sessions', {
    target_user_id: userId,
  });
  if (revokeError) {
    return Response.json({ error: 'Não foi possível encerrar as sessões do usuário.' }, { status: 500 });
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    return Response.json({ error: 'Não foi possível remover o usuário.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
