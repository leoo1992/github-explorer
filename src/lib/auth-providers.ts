import { cookies } from 'next/headers';

export type AuthProviderAvailability = {
  google: boolean;
  azure: boolean;
  emailConfirmationRequired: boolean;
};

type ProviderSettings = {
  external?: {
    google?: boolean;
    azure?: boolean;
  };
  mailer_autoconfirm?: boolean;
};

const NONE: AuthProviderAvailability = {
  google: false,
  azure: false,
  emailConfirmationRequired: false,
};
const FAILURE_COOKIE: Record<'google' | 'azure', string> = {
  google: 'reposcope_oauth_google_failed',
  azure: 'reposcope_oauth_azure_failed',
};

export async function getAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return NONE;

  try {
    const [response, cookieStore] = await Promise.all([
      fetch(`${url}/auth/v1/settings`, {
        headers: {
          apikey: publishableKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
      cookies(),
    ]);

    if (!response.ok) return NONE;

    const settings = (await response.json()) as ProviderSettings;

    return {
      google:
        settings.external?.google === true &&
        cookieStore.get(FAILURE_COOKIE.google)?.value !== '1',
      azure:
        settings.external?.azure === true &&
        cookieStore.get(FAILURE_COOKIE.azure)?.value !== '1',
      // Supabase calls the inverse setting `mailer_autoconfirm`.
      // Fail closed: signup is considered safe only when the API explicitly
      // confirms that automatic email confirmation is disabled.
      emailConfirmationRequired: settings.mailer_autoconfirm === false,
    };
  } catch {
    return NONE;
  }
}

export function describeAuthMethods(providers: AuthProviderAvailability): string {
  if (providers.google && providers.azure) return 'E-mail e senha, Google ou Microsoft.';
  if (providers.google) return 'E-mail e senha ou Google.';
  if (providers.azure) return 'E-mail e senha ou Microsoft.';
  return 'E-mail e senha.';
}

export const oauthFailureCookie = FAILURE_COOKIE;
