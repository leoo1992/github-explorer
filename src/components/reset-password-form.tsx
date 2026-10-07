'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PasswordField } from './auth-form';
import styles from './auth-form.module.css';

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (password !== passwordConfirmation) {
      setMessage('As senhas informadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      router.replace('/login?mode=login&password_reset=1');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2>Crie uma nova senha</h2>
      <p className={styles.note}>Digite a nova senha duas vezes para confirmar a alteração.</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          label="Confirmar nova senha"
          autoComplete="new-password"
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
          placeholder="Digite a nova senha novamente"
        />
        <button className={styles.primary} type="submit" disabled={loading}>
          {loading ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>

      {message ? <p className={styles.message}>{message}</p> : null}
    </div>
  );
}
