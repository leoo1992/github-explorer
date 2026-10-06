import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function idOf(value: string | { id: string } | null) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

async function upsertSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
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

  if (!userId) {
    throw new Error(`Assinatura ${subscription.id} sem vínculo com usuário.`);
  }

  const item = subscription.items.data[0];
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: idOf(subscription.customer),
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

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return Response.json({ error: 'Webhook Stripe não configurado.' }, { status: 503 });
  }

  try {
    const stripe = createStripeClient();
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = idOf(session.subscription);
      const userId = session.metadata?.supabase_user_id ?? session.client_reference_id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(subscription, userId);
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await upsertSubscription(event.data.object as Stripe.Subscription);
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Webhook inválido.' },
      { status: 400 },
    );
  }
}
