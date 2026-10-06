import Stripe from 'stripe';
import { stripeId, syncSubscription } from '@/lib/billing';
import { createStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

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
      const subscriptionId = stripeId(session.subscription);
      const userId = session.metadata?.supabase_user_id ?? session.client_reference_id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription, userId);
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Webhook inválido.' },
      { status: 400 },
    );
  }
}
