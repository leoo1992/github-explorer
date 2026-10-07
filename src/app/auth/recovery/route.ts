import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/forgot-password?error=recovery', url.origin), { status: 303 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    return NextResponse.redirect(new URL('/reset-password', url.origin), { status: 303 });
  } catch {
    return NextResponse.redirect(new URL('/forgot-password?error=recovery', url.origin), { status: 303 });
  }
}
