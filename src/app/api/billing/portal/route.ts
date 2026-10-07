import { createStripeClient } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return Response.json({ error: 'Faça login para gerenciar sua assinatura.' }, { status: 401 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (subscriptionError) {
      return Response.json({ error: 'Não foi possível localizar sua assinatura.' }, { status: 500 });
    }

    if (!subscription?.stripe_customer_id) {
      return Response.json({ error: 'Nenhuma assinatura foi encontrada para esta conta.' }, { status: 404 });
    }

    const stripe = createStripeClient();
    const origin = new URL(request.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/account`,
    });

    return Response.json(
      { url: portal.url },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Não foi possível abrir o portal da assinatura.' },
      { status: 500, headers: { 'cache-control': 'private, no-store' } },
    );
  }
}
