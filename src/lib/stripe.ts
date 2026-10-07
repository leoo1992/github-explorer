import Stripe from 'stripe';

export function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe ainda não foi configurado neste ambiente.');
  }

  return new Stripe(secretKey);
}
