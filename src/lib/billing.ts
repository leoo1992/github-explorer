import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export function stripeId(value: string | { id: string } | null) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

export async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  const supabase = createAdminClient();
  let userId = subscription.metadata.supabase_user_id || fallbackUserId || null;

  if (!userId) {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    userId = existing?.user_id ?? null;
  }

  if (!userId) throw new Error(`Assinatura ${subscription.id} sem vínculo com usuário.`);

  const item = subscription.items.data[0];
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeId(subscription.customer),
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: item?.price?.id ?? null,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) throw new Error(`Falha ao registrar assinatura: ${error.message}`);
}
