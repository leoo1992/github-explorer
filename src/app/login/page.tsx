import Link from 'next/link';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { describeAuthMethods, getAuthProviderAvailability } from '@/lib/auth-providers';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const providers = await getAuthProviderAvailability();
  const authMethods = describeAuthMethods(providers);
  const params = await searchParams;
  const signInMode = params.mode === 'login';
  const signupReady = providers.emailConfirmationRequired;

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
            <h1>
              {signInMode
                ? 'Entre na sua conta.'
                : signupReady
                  ? 'Crie sua conta para iniciar.'
                  : 'Cadastro temporariamente indisponível.'}
            </h1>
            <p>
              {signInMode
                ? 'Acesse o RepoScope com sua conta existente.'
                : signupReady
                  ? 'Crie sua conta e confirme o e-mail antes de acessar o plano.'
                  : 'A criação de novas contas está pausada até a confirmação de e-mail estar ativa.'}
            </p>
            <div className={styles.steps}>
              <div>
                <strong>1</strong>
                <span>
                  <b>{signInMode ? 'Entre na sua conta' : signupReady ? 'Crie sua conta' : 'Cadastro aguardando liberação'}</b>
                  <small>{signInMode || signupReady ? authMethods : 'Contas existentes continuam podendo entrar normalmente.'}</small>
                </span>
              </div>
              <div>
                <strong>2</strong>
                <span>
                  <b>{signInMode ? 'Acesse seu plano' : 'Escolha o plano'}</b>
                  <small>{signInMode ? 'Sua assinatura ou acesso administrativo é validado automaticamente.' : 'Pagamento seguro processado pelo Stripe.'}</small>
                </span>
              </div>
              <div><strong>3</strong><span><b>Analise</b><small>Repositórios públicos do GitHub.</small></span></div>
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
