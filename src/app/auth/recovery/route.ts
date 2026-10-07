import { NextResponse } from 'next/server';
import {
  createPasswordRecoveryProof,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_TTL_SECONDS,
} from '@/lib/password-recovery';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/forgot-password?error=recovery', url.origin), { status: 303 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) throw error ?? new Error('Usuário de recuperação não encontrado.');

    const response = NextResponse.redirect(new URL('/reset-password', url.origin), { status: 303 });
    response.cookies.set(PASSWORD_RECOVERY_COOKIE, createPasswordRecoveryProof(data.user.id), {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: PASSWORD_RECOVERY_TTL_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL('/forgot-password?error=recovery', url.origin), { status: 303 });
  }
}
