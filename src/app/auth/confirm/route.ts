import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: FormDataEntryValue | string | null) {
  return typeof value === 'string' && value.startsWith('/') ? value : '/pricing';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const code = url.searchParams.get('code');
  const type = url.searchParams.get('type');
  const next = safeNext(url.searchParams.get('next'));

  // GET never verifies or unlocks a user. This prevents email-security scanners
  // from granting access simply by prefetching the confirmation link.
  if ((tokenHash && type === 'email') || code) {
    const confirmation = new URL('/confirm-signup', url.origin);
    if (tokenHash && type === 'email') {
      confirmation.searchParams.set('token_hash', tokenHash);
      confirmation.searchParams.set('type', 'email');
    }
    if (code) confirmation.searchParams.set('code', code);
    confirmation.searchParams.set('next', next);
    return NextResponse.redirect(confirmation, { status: 303 });
  }

  return NextResponse.redirect(new URL('/login?mode=login&error=confirmation', url.origin), { status: 303 });
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  try {
    const form = await request.formData();
    const tokenHash = form.get('token_hash');
    const code = form.get('code');
    const type = form.get('type');
    const next = safeNext(form.get('next'));

    const supabase = await createClient();

    let userId = '';
    if (typeof code === 'string' && code.length > 0) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.user) throw error ?? new Error('user not returned');
      userId = data.user.id;
    } else if (typeof tokenHash === 'string' && tokenHash.length > 0 && type === 'email') {
      const { data, error } = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash: tokenHash,
      });
      if (error || !data.user) throw error ?? new Error('user not returned');
      userId = data.user.id;
    } else {
      throw new Error('invalid confirmation request');
    }

    const { data: verifiedUser, error: userError } = await supabase.auth.getUser();
    if (userError || !verifiedUser.user || verifiedUser.user.id !== userId) {
      throw userError ?? new Error('confirmed user mismatch');
    }

    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...verifiedUser.user.app_metadata,
        email_verified_manually: true,
      },
    });
    if (updateError) throw updateError;

    // Confirmation and login remain separate actions.
    await supabase.auth.signOut();

    const login = new URL('/login', url.origin);
    login.searchParams.set('mode', 'login');
    login.searchParams.set('confirmed', '1');
    login.searchParams.set('next', next);
    return NextResponse.redirect(login, { status: 303 });
  } catch {
    return NextResponse.redirect(new URL('/login?mode=login&error=confirmation', url.origin), { status: 303 });
  }
}
