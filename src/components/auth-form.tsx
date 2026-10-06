'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './auth-form.module.css';

type AuthMode = 'login' | 'signup';

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/pricing';

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

  async function handleOAuth(provider: 'google' | 'azure') {
    setLoading(true);
    setMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          ...(provider === 'azure' ? { scopes: 'email' } : {}),
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir o provedor de login.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.tabs}>
        <button type="button" className={mode === 'signup' ? styles.active : ''} onClick={() => setMode('signup')}>Criar conta</button>
        <button type="button" className={mode === 'login' ? styles.active : ''} onClick={() => setMode('login')}>Entrar</button>
      </div>

      <div className={styles.socialGrid}>
        <button type="button" onClick={() => void handleOAuth('google')} disabled={loading}><span>G</span> Continuar com Google</button>
        <button type="button" onClick={() => void handleOAuth('azure')} disabled={loading}><span>M</span> Continuar com Microsoft</button>
      </div>

      <div className={styles.divider}><span>ou use e-mail e senha</span></div>

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
