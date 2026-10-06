import { NextResponse } from 'next/server';
import { stripeId, syncSubscription } from '@/lib/billing';
import { createStripeClient } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ACCESS_STATUSES = new Set(['active', 'trialing']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) return NextResponse.redirect(new URL('/pricing?checkout=invalid', url));

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.redirect(new URL('/login?mode=login&next=/pricing', url));

    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUserId = session.metadata?.supabase_user_id ?? session.client_reference_id;

    if (!sessionUserId || sessionUserId !== userData.user.id) {
      return NextResponse.redirect(new URL('/pricing?checkout=forbidden', url));
    }

    if (session.payment_status === 'unpaid') {
      return NextResponse.redirect(new URL('/pricing?checkout=pending', url));
    }

    const subscriptionId = stripeId(session.subscription);
    if (!subscriptionId) return NextResponse.redirect(new URL('/pricing?checkout=pending', url));

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription, userData.user.id);

    if (!ACCESS_STATUSES.has(subscription.status)) {
      return NextResponse.redirect(new URL('/pricing?checkout=pending', url));
    }

    return NextResponse.redirect(new URL('/dashboard?checkout=success', url));
  } catch {
    return NextResponse.redirect(new URL('/pricing?checkout=error', url));
  }
}
