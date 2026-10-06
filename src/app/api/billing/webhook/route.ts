import Stripe from 'stripe';
import { stripeId, syncSubscription } from '@/lib/billing';
import { createStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const legacyInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  const legacyId = stripeId(legacyInvoice.subscription ?? null);
  if (legacyId) return legacyId;

  const subscription = invoice.parent?.subscription_details?.subscription ?? null;
  return stripeId(subscription);
}

async function syncCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const subscriptionId = stripeId(session.subscription);
  const userId = session.metadata?.supabase_user_id ?? session.client_reference_id;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(subscription, userId);
}

async function syncInvoiceSubscription(stripe: Stripe, invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(subscription);
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

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Delayed payment methods can emit completed while still unpaid.
        // Do not synchronize/grant access until payment is settled.
        if (session.payment_status !== 'unpaid') {
          await syncCheckoutSession(stripe, session);
        }
        break;
      }

      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed':
        await syncCheckoutSession(stripe, event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
      case 'invoice.payment_failed':
        await syncInvoiceSubscription(stripe, event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Webhook inválido.' },
      { status: 400 },
    );
  }
}
