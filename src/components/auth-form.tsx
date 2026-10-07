'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthProviderAvailability } from '@/lib/auth-providers';
import { isEmailVerifiedForAccess } from '@/lib/email-verification';
import { createClient } from '@/lib/supabase/client';
import styles from './auth-form.module.css';

type AuthMode = 'login' | 'signup';
type OAuthProvider = 'google' | 'azure';

type AuthFormProps = {
  initialProviders?: AuthProviderAvailability;
};

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'new-password' | 'current-password';
  placeholder?: string;
  showStrength?: boolean;
};

type PasswordRule = {
  label: string;
  valid: boolean;
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

export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: '8+ caracteres', valid: password.length >= 8 },
    { label: 'Maiúscula', valid: /[A-Z]/.test(password) },
    { label: 'Minúscula', valid: /[a-z]/.test(password) },
    { label: 'Número', valid: /[0-9]/.test(password) },
    { label: 'Símbolo', valid: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isStrongPassword(password: string) {
  return passwordRules(password).every((rule) => rule.valid);
}

function passwordStrength(password: string) {
  const score = passwordRules(password).filter((rule) => rule.valid).length;
  if (score === 5) return { label: 'Forte', level: 'strong' as const, score };
  if (score >= 3) return { label: 'Média', level: 'medium' as const, score };
  return { label: 'Fraca', level: 'weak' as const, score };
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.3A10.8 10.8 0 0112 4c5.2 0 8.8 4.5 9.7 5.8a3.7 3.7 0 010 4.4 15.8 15.8 0 01-2.5 2.8M6.2 6.2a16.4 16.4 0 00-3.9 3.6 3.7 3.7 0 000 4.4C3.2 15.5 6.8 20 12 20a10.7 10.7 0 005-1.2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.3 9.8C3.2 8.5 6.8 4 12 4s8.8 4.5 9.7 5.8a3.7 3.7 0 010 4.4C20.8 15.5 17.2 20 12 20S3.2 15.5 2.3 14.2a3.7 3.7 0 010-4.4z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder = 'Mínimo de 8 caracteres',
  showStrength = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const rules = passwordRules(value);
  const strength = passwordStrength(value);

  return (
    <label>
      {label}
      <span className={styles.passwordField}>
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={8}
          placeholder={placeholder}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <EyeIcon visible={visible} />
        </button>
      </span>

      {showStrength ? (
        <span className={styles.strengthBox} aria-live="polite">
          <span className={styles.strengthHead}>
            <span>Força da senha</span>
            <strong className={styles[`strength_${strength.level}`]}>{value ? strength.label : '—'}</strong>
          </span>
          <span className={styles.strengthTrack} aria-hidden="true">
            <span
              className={styles[`strengthBar_${strength.level}`]}
              style={{ width: value ? `${Math.max(20, strength.score * 20)}%` : '0%' }}
            />
          </span>
          <span className={styles.strengthRules}>
            {rules.map((rule) => (
              <span className={rule.valid ? styles.ruleOk : styles.rulePending} key={rule.label}>
                {rule.valid ? '✓' : '○'} {rule.label}
              </span>
            ))}
          </span>
          <small>Exemplo de senha forte: <b>Tst@1234</b></small>
        </span>
      ) : null}
    </label>
  );
}

function initialMessage(searchParams: ReturnType<typeof useSearchParams>) {
  if (searchParams.get('confirmed') === '1') return 'E-mail confirmado. Entre com sua senha para continuar.';
  if (searchParams.get('password_reset') === '1') return 'Senha alterada com sucesso. Entre com sua nova senha.';
  return '';
}

export function AuthForm({ initialProviders = NO_PROVIDERS }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: AuthMode = searchParams.get('mode') === 'login' ? 'login' : 'signup';
  const [email, setEmail] = useState('');
  const [emailConfirmation, setEmailConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(() => initialMessage(searchParams));
  const [providers, setProviders] = useState<AuthProviderAvailability>(initialProviders);

  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/dashboard';
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
    setEmailConfirmation('');
    setPassword('');
    setPasswordConfirmation('');

    const params = new URLSearchParams(searchParams.toString());
    params.delete('confirmed');
    params.delete('password_reset');
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
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === 'signup') {
        if (!providers.emailConfirmationRequired) {
          setMessage('Cadastro temporariamente indisponível porque a confirmação obrigatória de e-mail não está ativa.');
          return;
        }

        if (normalizedEmail !== emailConfirmation.trim().toLowerCase()) {
          setMessage('Os e-mails informados não coincidem.');
          return;
        }

        if (!isStrongPassword(password)) {
          setMessage('Use uma senha forte com 8+ caracteres, maiúscula, minúscula, número e símbolo.');
          return;
        }

        if (password !== passwordConfirmation) {
          setMessage('As senhas informadas não coincidem.');
          return;
        }

        const confirmationPage = `${window.location.origin}/confirm-signup?next=${encodeURIComponent(next)}`;
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: confirmationPage,
          },
        });
        if (error) throw error;

        if (data.session) {
          await supabase.auth.signOut();
        }

        setPassword('');
        setPasswordConfirmation('');
        setMessage('Conta criada. Confirme seu e-mail antes de entrar. O acesso permanece bloqueado até a confirmação manual.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;

        if (!data.user || !isEmailVerifiedForAccess(data.user)) {
          await supabase.auth.signOut();
          setMessage('Confirme seu e-mail antes de entrar. O acesso ainda não foi liberado.');
          return;
        }

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
  const normalizedEmail = email.trim().toLowerCase();
  const signupFormReady =
    signupEnabled &&
    normalizedEmail.length > 0 &&
    normalizedEmail === emailConfirmation.trim().toLowerCase() &&
    isStrongPassword(password) &&
    passwordConfirmation.length > 0 &&
    password === passwordConfirmation;

  return (
    <div className={styles.card}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={mode === 'signup' ? styles.active : ''}
          onClick={() => switchMode('signup')}
        >
          Criar conta
        </button>
        <button type="button" className={mode === 'login' ? styles.active : ''} onClick={() => switchMode('login')}>
          Entrar
        </button>
      </div>

      {!signupEnabled && mode === 'signup' ? (
        <p className={styles.message}>Cadastro temporariamente indisponível porque a confirmação obrigatória de e-mail não está ativa.</p>
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

        {mode === 'signup' ? (
          <label>
            Confirmar e-mail
            <input
              type="email"
              autoComplete="email"
              value={emailConfirmation}
              onChange={(event) => setEmailConfirmation(event.target.value)}
              required
              placeholder="Digite seu e-mail novamente"
            />
          </label>
        ) : null}

        <PasswordField
          label="Senha"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={setPassword}
          showStrength={mode === 'signup'}
        />

        {mode === 'signup' ? (
          <PasswordField
            label="Confirmar senha"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={setPasswordConfirmation}
            placeholder="Digite sua senha novamente"
          />
        ) : null}

        {mode === 'login' ? (
          <div className={styles.formActions}>
            <Link href="/forgot-password">Esqueci minha senha</Link>
          </div>
        ) : null}

        <button
          className={styles.primary}
          type="submit"
          disabled={loading || (mode === 'signup' && !signupFormReady)}
        >
          {loading ? 'Processando…' : mode === 'signup' ? 'Criar conta e continuar' : 'Entrar'}
        </button>
      </form>

      {message ? <p className={styles.message}>{message}</p> : null}
      <p className={styles.note}>
        {mode === 'signup'
          ? 'Somente a confirmação manual do e-mail libera o login por senha.'
          : 'Depois do login você será direcionado para o próximo passo do seu acesso.'}
      </p>
    </div>
  );
}
