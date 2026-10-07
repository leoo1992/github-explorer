import Link from 'next/link';
import { BrandIcon } from '@/components/brand-icon';
import { ForgotPasswordForm } from '@/components/forgot-password-form';
import styles from '../login/page.module.css';

export const dynamic = 'force-dynamic';

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const recoveryError = params.error === 'recovery';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.brand} href="/">
          <BrandIcon className={styles.brandIcon} />
          <div><strong>RepoScope</strong><small>Engineering Intelligence</small></div>
        </Link>

        <section className={styles.grid}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Recuperação de acesso</p>
            <h1>Esqueceu sua senha?</h1>
            <p>Solicite um link de redefinição. A nova senha só poderá ser criada depois da validação do e-mail.</p>
            <div className={styles.steps}>
              <div><strong>1</strong><span><b>Informe seu e-mail</b><small>Use o endereço cadastrado no RepoScope.</small></span></div>
              <div><strong>2</strong><span><b>Abra o link recebido</b><small>O link é temporário e leva de volta ao RepoScope.</small></span></div>
              <div><strong>3</strong><span><b>Defina a nova senha</b><small>Digite e confirme a nova senha antes de salvar.</small></span></div>
            </div>
          </div>

          <ForgotPasswordForm recoveryError={recoveryError} />
        </section>
      </div>
    </main>
  );
}
