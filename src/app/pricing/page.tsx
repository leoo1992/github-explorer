import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckoutButton } from '@/components/checkout-button';
import { getAccessState } from '@/lib/access';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const access = await getAccessState();
  if (!access.user) redirect('/login?mode=login&next=/pricing');
  if (access.paid) redirect('/dashboard');

  const priceLabel = process.env.NEXT_PUBLIC_PLAN_PRICE_LABEL ?? 'R$ 9,90/mês';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={`theme-header ${styles.header}`}>
          <Link href="/" className={styles.brand}>RepoScope <span>Engineering Intelligence</span></Link>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm" type="submit">Sair</button></form>
        </header>

        <section className={styles.hero}>
          <p>PASSO 2 DE 2</p>
          <h1>Ative sua assinatura para liberar as avaliações.</h1>
          <span>Seu cadastro está concluído. O acesso ao motor de análise permanece bloqueado até a confirmação do pagamento.</span>
        </section>

        <section className={`card ${styles.plan}`}>
          <div className={styles.planHead}>
            <div><small>REPOSCOPE PRO</small><h2>Engineering Intelligence</h2><p>Para recrutadores, Tech Leads e equipes que precisam avaliar repositórios com critérios consistentes.</p></div>
            <div className={styles.price}><strong>{priceLabel}</strong><span>assinatura recorrente</span></div>
          </div>

          <div className={styles.features}>
            <div><b>✓</b><span><strong>Análise de repositório</strong><small>Arquitetura, stack, dependências, estrutura e sinais de qualidade.</small></span></div>
            <div><b>✓</b><span><strong>Critérios configuráveis</strong><small>Escolha quais sinais técnicos entram no cálculo da qualidade.</small></span></div>
            <div><b>✓</b><span><strong>Estrutura técnica detalhada</strong><small>Explore arquivos, arquitetura, linguagens, stack e dependências do repositório.</small></span></div>
            <div><b>✓</b><span><strong>Evidências explicáveis</strong><small>O score mostra quais sinais técnicos foram encontrados e quais estão ausentes.</small></span></div>
          </div>

          <div className={styles.checkout}><CheckoutButton /><small>Pagamento seguro. O acesso é liberado após a confirmação da assinatura.</small></div>
        </section>

        <p className={styles.trust}>RepoScope oferece apoio à análise técnica. Os sinais do GitHub não devem ser usados como decisão automática de contratação e não substituem entrevista técnica ou contexto de projeto.</p>
      </div>
    </main>
  );
}
