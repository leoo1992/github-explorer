'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './auth-form.module.css';

type AuthMode = 'login' | 'signup';
type OAuthProvider = 'google' | 'azure';
type ProviderState = Record<OAuthProvider, boolean>;

type AuthFormProps = {
  initialProviders?: ProviderState;
};

const FAILED_PROVIDER_KEY: Record<OAuthProvider, string> = {
  google: 'reposcope.oauth.google.failed',
  azure: 'reposcope.oauth.azure.failed',
};

const FAILED_PROVIDER_COOKIE: Record<OAuthProvider, string> = {
  google: 'reposcope_oauth_google_failed',
  azure: 'reposcope_oauth_azure_failed',
};

const NO_PROVIDERS: ProviderState = { google: false, azure: false };

export function AuthForm({ initialProviders = NO_PROVIDERS }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [providers, setProviders] = useState<ProviderState>(initialProviders);

  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/pricing';
  const failedProvider = searchParams.get('error') === 'oauth' ? searchParams.get('provider') : null;

  useEffect(() => {
    let cancelled = false;

    if (failedProvider === 'google' || failedProvider === 'azure') {
      sessionStorage.setItem(FAILED_PROVIDER_KEY[failedProvider], '1');
    }

    async function loadProviders() {
      try {
        const response = await fetch('/api/auth/providers', { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setProviders(NO_PROVIDERS);
          return;
        }

        const data = (await response.json()) as Partial<ProviderState>;
        if (cancelled) return;

        setProviders({
          google: data.google === true && sessionStorage.getItem(FAILED_PROVIDER_KEY.google) !== '1',
          azure: data.azure === true && sessionStorage.getItem(FAILED_PROVIDER_KEY.azure) !== '1',
        });
      } catch {
        if (!cancelled) setProviders(NO_PROVIDERS);
      }
    }

    void loadProviders();
    return () => {
      cancelled = true;
    };
  }, [failedProvider]);

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const supabase = createClient();

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        setMessage('Conta criada. Verifique seu e-mail para confirmar o cadastro.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível autenticar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setLoading(true);
    setMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&provider=${provider}`,
          ...(provider === 'azure' ? { scopes: 'email' } : {}),
        },
      });
      if (error) throw error;
    } catch (error) {
      sessionStorage.setItem(FAILED_PROVIDER_KEY[provider], '1');
      document.cookie = `${FAILED_PROVIDER_COOKIE[provider]}=1; Path=/; Max-Age=600; SameSite=Lax`;
      setProviders((current) => ({ ...current, [provider]: false }));
      setMessage('Este método de login está indisponível no momento. Use e-mail e senha.');
      setLoading(false);
    }
  }

  const visibleProviderCount = Number(providers.google) + Number(providers.azure);

  return (
    <div className={styles.card}>
      <div className={styles.tabs}>
        <button type="button" className={mode === 'signup' ? styles.active : ''} onClick={() => setMode('signup')}>Criar conta</button>
        <button type="button" className={mode === 'login' ? styles.active : ''} onClick={() => setMode('login')}>Entrar</button>
      </div>

      {visibleProviderCount > 0 ? (
        <>
          <div className={`${styles.socialGrid} ${visibleProviderCount === 1 ? styles.singleProvider : ''}`}>
            {providers.google ? (
              <button type="button" onClick={() => void handleOAuth('google')} disabled={loading}><span>G</span> Continuar com Google</button>
            ) : null}
            {providers.azure ? (
              <button type="button" onClick={() => void handleOAuth('azure')} disabled={loading}><span>M</span> Continuar com Microsoft</button>
            ) : null}
          </div>
          <div className={styles.divider}><span>ou use e-mail e senha</span></div>
        </>
      ) : null}

      <form onSubmit={handleCredentials} className={styles.form}>
        <label>
          E-mail
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="voce@empresa.com" />
        </label>
        <label>
          Senha
          <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} placeholder="Mínimo de 8 caracteres" />
        </label>
        <button className={styles.primary} type="submit" disabled={loading}>
          {loading ? 'Processando…' : mode === 'signup' ? 'Criar conta e continuar' : 'Entrar'}
        </button>
      </form>

      {message ? <p className={styles.message}>{message}</p> : null}
      <p className={styles.note}>Depois do login você será direcionado ao pagamento. As avaliações só ficam disponíveis com assinatura ativa.</p>
    </div>
  );
}
