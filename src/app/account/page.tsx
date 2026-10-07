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
  const status = internalAccess
    ? 'Administrador'
    : access.paid
      ? access.subscription?.status ?? 'Ativo'
      : access.freeGrantActive
        ? 'Acesso gratuito'
        : access.freeAnalysisAvailable
          ? '1 análise gratuita disponível'
          : 'Sem acesso ativo';

  const plan = internalAccess
    ? 'Interno'
    : access.paid
      ? 'RepoScope Pro'
      : access.freeGrantActive
        ? '30 dias grátis'
        : access.freeAnalysisAvailable
          ? 'Cortesia inicial'
          : 'RepoScope Pro';

  const period = internalAccess
    ? 'Permanente'
    : access.paid
      ? formatDate(access.subscription?.current_period_end ?? null)
      : access.freeGrantActive
        ? `${access.freeGrantDaysRemaining} dias restantes · até ${formatDate(access.freeGrantUntil)}`
        : access.freeAnalysisAvailable
          ? 'Disponível até concluir 1 análise válida'
          : 'Encerrado';

  return (
    <main className={styles.page}>
      <section className={`card ${styles.card}`}>
        <Link href="/dashboard" className={styles.brand}>RepoScope</Link>
        <p className={styles.eyebrow}>CONTA E ACESSO</p>
        <h1>{internalAccess ? 'Acesso administrativo ao RepoScope.' : 'Gerencie seu acesso ao RepoScope.'}</h1>
        <div className={styles.details}>
          <div><span>Conta</span><strong>{access.user.email ?? 'Usuário autenticado'}</strong></div>
          <div><span>Status</span><strong>{status}</strong></div>
          <div><span>Plano</span><strong>{plan}</strong></div>
          <div><span>Período atual</span><strong>{period}</strong></div>
        </div>

        {internalAccess ? (
          <div className={styles.actions}>
            <Link href="/admin" className={`btn btn-primary ${styles.cta}`}>Painel administrativo</Link>
            <Link href="/presets" className={`btn btn-ghost ${styles.secondaryCta}`}>Gerenciar presets</Link>
            <Link href="/dashboard" className={`btn btn-ghost ${styles.secondaryCta}`}>Ir para o dashboard</Link>
          </div>
        ) : access.paid && access.subscription ? (
          <div className={styles.actions}>
            <Link href="/dashboard" className={`btn btn-primary ${styles.cta}`}>Ir para o dashboard</Link>
            <Link href="/presets" className={`btn btn-ghost ${styles.secondaryCta}`}>Gerenciar presets</Link>
            <BillingPortalButton />
          </div>
        ) : access.canAnalyze ? (
          <div className={styles.actions}>
            <Link href="/dashboard" className={`btn btn-primary ${styles.cta}`}>Ir para o dashboard</Link>
            <Link href="/pricing" className={`btn btn-ghost ${styles.secondaryCta}`}>Ver plano</Link>
          </div>
        ) : (
          <Link href="/pricing" className={`btn btn-primary ${styles.cta}`}>Ativar RepoScope Pro</Link>
        )}

        <p className={styles.note}>
          {internalAccess
            ? 'Conta interna com acesso administrativo e monitoramento operacional.'
            : access.freeGrantActive
              ? `Seu acesso gratuito termina em ${access.freeGrantDaysRemaining} dias.`
              : access.freeAnalysisAvailable
                ? 'Sua conta possui 1 análise válida gratuita antes da ativação do plano.'
                : 'Alterações de pagamento, cancelamento e método de cobrança são processadas em um portal de pagamento seguro.'}
        </p>
      </section>
    </main>
  );
}
