'use client';

import { useState } from 'react';

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function openPortal() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? 'Não foi possível abrir sua assinatura.');
      window.location.assign(body.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível abrir sua assinatura.');
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void openPortal()} disabled={loading}>
        {loading ? 'Abrindo pagamento seguro…' : 'Gerenciar assinatura'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
