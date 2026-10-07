import type { User } from '@supabase/supabase-js';
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
};

const PAID_STATUSES = new Set(['active', 'trialing']);

export async function getAccessState(): Promise<AccessState> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user || !isEmailVerifiedForAccess(userData.user)) {
    return { user: null, paid: false, admin: false, subscription: null };
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('status, price_id, current_period_end')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error(`Não foi possível validar a assinatura: ${subscriptionError.message}`);
  }

  const admin = userData.user.app_metadata?.role === 'admin' || subscription?.price_id === 'internal_admin';

  return {
    user: userData.user,
    admin,
    paid: admin || Boolean(subscription && PAID_STATUSES.has(subscription.status)),
    subscription,
  };
}

export async function requirePaidApiAccess() {
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

    if (!access.paid) {
      return {
        access: null,
        response: Response.json(
          { error: 'Assinatura ativa necessária para executar avaliações.', code: 'PAYMENT_REQUIRED' },
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
