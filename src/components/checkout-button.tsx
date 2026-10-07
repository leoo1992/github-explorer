'use client';

import { useState } from 'react';

export function CheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkout() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? 'Não foi possível abrir o pagamento.');
      window.location.assign(body.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível abrir o pagamento.');
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary" type="button" onClick={() => void checkout()} disabled={loading}>
        {loading ? 'Abrindo pagamento…' : 'Assinar e liberar avaliações'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
