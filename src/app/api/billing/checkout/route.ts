import { createClient } from '@/lib/supabase/server';
import { createStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return Response.json({ error: 'Faça login antes de assinar.' }, { status: 401 });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return Response.json({ error: 'Plano de pagamento ainda não foi configurado.' }, { status: 503 });
    }

    const stripe = createStripeClient();
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      client_reference_id: userData.user.id,
      customer_email: userData.user.email,
      allow_promotion_codes: true,
      metadata: { supabase_user_id: userData.user.id },
      subscription_data: { metadata: { supabase_user_id: userData.user.id } },
    });

    if (!session.url) {
      return Response.json({ error: 'Não foi possível iniciar o checkout.' }, { status: 500 });
    }

    return Response.json({ url: session.url }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.' },
      { status: 500, headers: { 'cache-control': 'private, no-store' } },
    );
  }
}
