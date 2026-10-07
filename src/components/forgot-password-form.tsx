'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './auth-form.module.css';

export function ForgotPasswordForm({ recoveryError = false }: { recoveryError?: boolean }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    recoveryError ? 'O link de recuperação é inválido ou expirou. Solicite um novo e-mail.' : '',
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });

      if (error) throw error;

      setMessage('Se existir uma conta com esse e-mail, enviaremos as instruções para redefinir a senha.');
    } catch {
      setMessage('Não foi possível solicitar a redefinição agora. Tente novamente em alguns minutos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2>Redefinir senha</h2>
      <p className={styles.note}>Informe o e-mail da sua conta. Você receberá um link seguro para criar uma nova senha.</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label>
          E-mail
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="voce@empresa.com"
          />
        </label>

        <button className={styles.primary} type="submit" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar link de redefinição'}
        </button>
      </form>

      {message ? <p className={styles.message}>{message}</p> : null}

      <div className={styles.centerLink}>
        <Link className={styles.secondaryLink} href="/login?mode=login">Voltar para entrar</Link>
      </div>
    </div>
  );
}
