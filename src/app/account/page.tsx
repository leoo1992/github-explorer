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
  if (!access.user) redirect('/login?mode=login&next=/account');

  const internalAccess = access.admin;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/dashboard" className={styles.brand}>RepoScope</Link>
        <p className={styles.eyebrow}>CONTA E ACESSO</p>
        <h1>{internalAccess ? 'Acesso administrativo ao RepoScope.' : 'Gerencie seu acesso ao RepoScope Pro.'}</h1>
        <div className={styles.details}>
          <div><span>Conta</span><strong>{access.user.email ?? 'Usuário autenticado'}</strong></div>
          <div><span>Status</span><strong>{internalAccess ? 'Administrador' : access.subscription?.status ?? 'Sem assinatura'}</strong></div>
          <div><span>Plano</span><strong>{internalAccess ? 'Interno' : 'RepoScope Pro'}</strong></div>
          <div><span>Período atual</span><strong>{internalAccess ? 'Permanente' : formatDate(access.subscription?.current_period_end ?? null)}</strong></div>
        </div>

        {internalAccess ? (
          <div className={styles.actions}>
            <Link href="/admin" className={styles.cta}>Painel administrativo</Link>
            <Link href="/dashboard" className={styles.secondaryCta}>Ir para o dashboard</Link>
          </div>
        ) : access.subscription ? (
          <BillingPortalButton />
        ) : (
          <Link href="/pricing" className={styles.cta}>Assinar RepoScope Pro</Link>
        )}

        <p className={styles.note}>
          {internalAccess
            ? 'Conta interna com acesso administrativo e monitoramento operacional.'
            : 'Alterações de pagamento, cancelamento e método de cobrança são processadas no portal seguro do Stripe.'}
        </p>
      </section>
    </main>
  );
}
