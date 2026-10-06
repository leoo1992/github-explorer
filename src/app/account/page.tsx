import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BillingPortalButton } from '@/components/billing-portal-button';
import { getAccessState } from '@/lib/access';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(value));
}

export default async function AccountPage() {
  const access = await getAccessState();
  if (!access.user) redirect('/login?next=/account');

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/dashboard" className={styles.brand}>RepoScope</Link>
        <p className={styles.eyebrow}>CONTA E ASSINATURA</p>
        <h1>Gerencie seu acesso ao RepoScope Pro.</h1>
        <div className={styles.details}>
          <div><span>Conta</span><strong>{access.user.email ?? 'Usuário autenticado'}</strong></div>
          <div><span>Status</span><strong>{access.subscription?.status ?? 'Sem assinatura'}</strong></div>
          <div><span>Preço</span><strong>R$ 9,90/mês</strong></div>
          <div><span>Período atual</span><strong>{formatDate(access.subscription?.current_period_end ?? null)}</strong></div>
        </div>

        {access.subscription ? (
          <BillingPortalButton />
        ) : (
          <Link href="/pricing" className={styles.cta}>Assinar RepoScope Pro</Link>
        )}

        <p className={styles.note}>Alterações de pagamento, cancelamento e método de cobrança são processadas no portal seguro do Stripe.</p>
      </section>
    </main>
  );
}
