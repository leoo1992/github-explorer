import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: FormDataEntryValue | string | null) {
  return typeof value === 'string' && value.startsWith('/') ? value : '/pricing';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = safeNext(url.searchParams.get('next'));

  // GET never verifies a user. This prevents email-security scanners from
  // confirming accounts simply by prefetching links.
  if (tokenHash && type === 'email') {
    const confirmation = new URL('/confirm-signup', url.origin);
    confirmation.searchParams.set('token_hash', tokenHash);
    confirmation.searchParams.set('type', 'email');
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
    const type = form.get('type');
    const next = safeNext(form.get('next'));

    if (typeof tokenHash !== 'string' || tokenHash.length === 0 || type !== 'email') {
      throw new Error('invalid confirmation request');
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    });
    if (error) throw error;

    // Confirmation and login remain separate actions. Clear the temporary
    // session created by verifyOtp so the user must authenticate explicitly.
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
