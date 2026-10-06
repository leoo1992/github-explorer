'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthProviderAvailability } from '@/lib/auth-providers';
import { createClient } from '@/lib/supabase/client';
import styles from './auth-form.module.css';

type AuthMode = 'login' | 'signup';
type OAuthProvider = 'google' | 'azure';

type AuthFormProps = {
  initialProviders?: AuthProviderAvailability;
};

const FAILED_PROVIDER_KEY: Record<OAuthProvider, string> = {
  google: 'reposcope.oauth.google.failed',
  azure: 'reposcope.oauth.azure.failed',
};

const FAILED_PROVIDER_COOKIE: Record<OAuthProvider, string> = {
  google: 'reposcope_oauth_google_failed',
  azure: 'reposcope_oauth_azure_failed',
};

const NO_PROVIDERS: AuthProviderAvailability = {
  google: false,
  azure: false,
  emailConfirmationRequired: false,
};

export function AuthForm({ initialProviders = NO_PROVIDERS }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: AuthMode = searchParams.get('mode') === 'login' ? 'login' : 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    searchParams.get('confirmed') === '1' ? 'E-mail confirmado. Entre com sua senha para continuar.' : '',
  );
  const [providers, setProviders] = useState<AuthProviderAvailability>(initialProviders);

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

        const data = (await response.json()) as Partial<AuthProviderAvailability>;
        if (cancelled) return;

        setProviders({
          google: data.google === true && sessionStorage.getItem(FAILED_PROVIDER_KEY.google) !== '1',
          azure: data.azure === true && sessionStorage.getItem(FAILED_PROVIDER_KEY.azure) !== '1',
          emailConfirmationRequired: data.emailConfirmationRequired === true,
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

  function switchMode(nextMode: AuthMode) {
    setMessage('');

    const params = new URLSearchParams(searchParams.toString());
    params.delete('confirmed');
    if (nextMode === 'login') params.set('mode', 'login');
    else params.delete('mode');

    const query = params.toString();
    router.replace(query ? `/login?${query}` : '/login', { scroll: false });
  }

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const supabase = createClient();

      if (mode === 'signup') {
        if (!providers.emailConfirmationRequired) {
          setMessage('Cadastro temporariamente indisponível até a verificação segura de e-mail estar configurada.');
          return;
        }

        const confirmationPage = `${window.location.origin}/confirm-signup?next=${encodeURIComponent(next)}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: confirmationPage,
          },
        });
        if (error) throw error;

        if (data.session) {
          await supabase.auth.signOut();
          setMessage('Cadastro não concluído porque a verificação de e-mail está indisponível.');
          return;
        }

        setPassword('');
        setMessage('Conta criada. Abra o e-mail e conclua a confirmação manual antes de entrar.');
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
    } catch {
      sessionStorage.setItem(FAILED_PROVIDER_KEY[provider], '1');
      document.cookie = `${FAILED_PROVIDER_COOKIE[provider]}=1; Path=/; Max-Age=600; SameSite=Lax`;
      setProviders((current) => ({ ...current, [provider]: false }));
      setMessage('Este método de login está indisponível no momento. Use e-mail e senha.');
      setLoading(false);
    }
  }

  const visibleProviderCount = Number(providers.google) + Number(providers.azure);
  const signupEnabled = providers.emailConfirmationRequired;

  return (
    <div className={styles.card}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={mode === 'signup' ? styles.active : ''}
          onClick={() => switchMode('signup')}
          disabled={!signupEnabled}
          title={signupEnabled ? undefined : 'Cadastro aguardando configuração da verificação segura de e-mail'}
        >
          Criar conta
        </button>
        <button type="button" className={mode === 'login' ? styles.active : ''} onClick={() => switchMode('login')}>
          Entrar
        </button>
      </div>

      {!signupEnabled && mode === 'signup' ? (
        <p className={styles.message}>Cadastro temporariamente indisponível até a verificação segura de e-mail estar configurada.</p>
      ) : null}

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
        <button className={styles.primary} type="submit" disabled={loading || (mode === 'signup' && !signupEnabled)}>
          {loading ? 'Processando…' : mode === 'signup' ? 'Criar conta e continuar' : 'Entrar'}
        </button>
      </form>

      {message ? <p className={styles.message}>{message}</p> : null}
      <p className={styles.note}>
        {mode === 'signup'
          ? 'Depois de confirmar o e-mail manualmente, entre na sua conta para continuar ao plano.'
          : 'Depois do login você será direcionado para o próximo passo do seu acesso.'}
      </p>
    </div>
  );
}
