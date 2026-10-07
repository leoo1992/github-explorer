import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { createClient } from '@/lib/supabase/server';
import styles from '../login/page.module.css';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect('/forgot-password?error=recovery');
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.brand} href="/">
          <span>RS</span>
          <div><strong>RepoScope</strong><small>Engineering Intelligence</small></div>
        </Link>

        <section className={styles.grid}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Nova senha</p>
            <h1>Redefina sua senha.</h1>
            <p>Crie uma senha nova para sua conta. Depois da alteração, você precisará entrar novamente.</p>
            <div className={styles.steps}>
              <div><strong>1</strong><span><b>Nova senha</b><small>Use pelo menos 8 caracteres.</small></span></div>
              <div><strong>2</strong><span><b>Confirme a senha</b><small>Os dois campos precisam ser idênticos.</small></span></div>
              <div><strong>3</strong><span><b>Entre novamente</b><small>A sessão de recuperação será encerrada após a troca.</small></span></div>
            </div>
          </div>

          <ResetPasswordForm />
        </section>
      </div>
    </main>
  );
}
