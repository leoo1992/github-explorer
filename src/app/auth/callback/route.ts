import { NextResponse } from 'next/server';
import { oauthFailureCookie } from '@/lib/auth-providers';
import { createClient } from '@/lib/supabase/server';

function isOAuthProvider(value: string | null): value is 'google' | 'azure' {
  return value === 'google' || value === 'azure';
}

function markProviderHealthy(response: NextResponse, provider: string | null) {
  if (!isOAuthProvider(provider)) return response;

  response.cookies.set(oauthFailureCookie[provider], '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

function markProviderFailed(response: NextResponse, provider: string | null) {
  if (!isOAuthProvider(provider)) return response;

  response.cookies.set(oauthFailureCookie[provider], '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const provider = searchParams.get('provider');
  let next = searchParams.get('next') ?? '/pricing';

  if (!next.startsWith('/')) next = '/pricing';

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const forwardedHost = request.headers.get('x-forwarded-host');
        if (process.env.NODE_ENV === 'development') {
          return markProviderHealthy(NextResponse.redirect(`${origin}${next}`), provider);
        }
        if (forwardedHost) {
          return markProviderHealthy(NextResponse.redirect(`https://${forwardedHost}${next}`), provider);
        }
        return markProviderHealthy(NextResponse.redirect(`${origin}${next}`), provider);
      }
    } catch {
      // O provedor é ocultado temporariamente e o login cai no fallback seguro.
    }
  }

  const providerQuery = isOAuthProvider(provider) ? `&provider=${provider}` : '';
  const response = NextResponse.redirect(`${origin}/login?error=oauth${providerQuery}`);
  return markProviderFailed(response, provider);
}
