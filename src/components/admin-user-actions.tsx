'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './admin-user-actions.module.css';

type AdminUserActionsProps = {
  userId: string;
  email: string;
  admin: boolean;
};

export function AdminUserActions({ userId, email, admin }: AdminUserActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<'grant' | 'delete' | null>(null);
  const [error, setError] = useState('');

  if (admin) return <span className={styles.protected}>Protegido</span>;

  async function grant() {
    setBusy('grant');
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'grant_30_days' }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível conceder o acesso gratuito.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const confirmed = window.confirm(
      `Remover permanentemente ${email}? Sessões serão encerradas e uma assinatura ativa será cancelada.`,
    );
    if (!confirmed) return;

    setBusy('delete');
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível remover o usuário.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.actions}>
      <div className={styles.buttons}>
        <button className="btn btn-soft btn-success btn-sm" type="button" onClick={() => void grant()} disabled={busy !== null}>
          {busy === 'grant' ? 'Concedendo…' : 'Dar 30 dias grátis'}
        </button>
        <button className="btn btn-soft btn-error btn-sm" type="button" onClick={() => void remove()} disabled={busy !== null}>
          {busy === 'delete' ? 'Removendo…' : 'Remover'}
        </button>
      </div>
      {error ? <small className={styles.error} role="alert">{error}</small> : null}
    </div>
  );
}
