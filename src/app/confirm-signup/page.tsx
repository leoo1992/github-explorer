import Link from 'next/link';
import styles from '../login/page.module.css';
import authStyles from '@/components/auth-form.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Confirmar e-mail | RepoScope',
  referrer: 'no-referrer' as const,
};

type ConfirmSignupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConfirmSignupPage({ searchParams }: ConfirmSignupPageProps) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : '';
  const type = typeof params.type === 'string' ? params.type : '';
  const requestedNext = typeof params.next === 'string' && params.next.startsWith('/') ? params.next : '/pricing';
  const valid = tokenHash.length > 0 && type === 'email';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link className={styles.brand} href="/">
          <span>RS</span>
          <div><strong>RepoScope</strong><small>Engineering Intelligence</small></div>
        </Link>

        <section className={styles.grid}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Verificação de e-mail</p>
            <h1>{valid ? 'Confirme que foi você.' : 'Link de confirmação inválido.'}</h1>
            <p>
              {valid
                ? 'A conta só será confirmada depois que você pressionar o botão ao lado. Abrir este endereço automaticamente não ativa a conta.'
                : 'Solicite um novo cadastro ou volte para a tela de acesso.'}
            </p>
            <div className={styles.steps}>
              <div><strong>1</strong><span><b>Receba o e-mail</b><small>O link apenas abre esta página.</small></span></div>
              <div><strong>2</strong><span><b>Confirme manualmente</b><small>A verificação acontece somente após sua ação.</small></span></div>
              <div><strong>3</strong><span><b>Entre</b><small>Use seu e-mail e senha para continuar.</small></span></div>
            </div>
          </div>

          <div className={authStyles.card}>
            <h2>{valid ? 'Confirmar e-mail' : 'Não foi possível validar o link'}</h2>
            {valid ? (
              <form className={authStyles.form} action="/auth/confirm" method="post">
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="type" value="email" />
                <input type="hidden" name="next" value={requestedNext} />
                <button className={authStyles.primary} type="submit">Confirmar meu e-mail</button>
              </form>
            ) : (
              <Link href="/login?mode=login" className={authStyles.primary}>Voltar para entrar</Link>
            )}
            <p className={authStyles.note}>Nenhuma confirmação é executada por uma simples requisição GET.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
