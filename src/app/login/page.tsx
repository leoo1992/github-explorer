import Link from 'next/link';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { describeAuthMethods, getAuthProviderAvailability } from '@/lib/auth-providers';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const providers = await getAuthProviderAvailability();
  const authMethods = describeAuthMethods(providers);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.brand} href="/">
          <span>RS</span>
          <div><strong>RepoScope</strong><small>Engineering Intelligence</small></div>
        </Link>

        <section className={styles.grid}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Acesso seguro</p>
            <h1>Crie sua conta para iniciar.</h1>
            <p>O cadastro é gratuito. As análises técnicas são liberadas somente depois da contratação do plano.</p>
            <div className={styles.steps}>
              <div><strong>1</strong><span><b>Crie sua conta</b><small>{authMethods}</small></span></div>
              <div><strong>2</strong><span><b>Escolha o plano</b><small>Pagamento seguro processado pelo Stripe.</small></span></div>
              <div><strong>3</strong><span><b>Analise</b><small>Repositórios, owners e projetos públicos.</small></span></div>
            </div>
          </div>
          <Suspense fallback={<div className={styles.loading}>Carregando acesso…</div>}>
            <AuthForm initialProviders={providers} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
