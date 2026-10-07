import Link from 'next/link';
import { BookMarked, Check, Minus } from 'lucide-react';
import { BrandIcon } from '@/components/brand-icon';
import { describeAuthMethods, getAuthProviderAvailability } from '@/lib/auth-providers';
import styles from './home.module.css';

const signals = [
  ['CI/CD', 'Encontrado', true],
  ['Testes automatizados', 'Encontrado', true],
  ['Lint e type checking', 'Encontrado', true],
  ['Docker', 'Encontrado', true],
  ['Cobertura ≥ 80%', 'Não confirmado', false],
  ['Documentação técnica', 'Parcial', false],
] as const;

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const providers = await getAuthProviderAvailability();
  const authMethods = describeAuthMethods(providers);
  const signupReady = providers.emailConfirmationRequired;
  const loginHref = '/login?mode=login&next=/dashboard';
  const signupHref = '/login?next=/dashboard';

  return (
    <main className={styles.page}>
      <header className={`theme-header ${styles.header}`}>
        <Link href="/" className={styles.brand}><BrandIcon className={styles.brandIcon} /><div><strong>RepoScope</strong><small>Engineering Intelligence</small></div></Link>
        <nav>
          <a href="#como-funciona">Como funciona</a>
          <a href="#exemplo">Exemplo</a>
          <Link href={loginHref} className={`btn btn-ghost ${styles.login}`}>Entrar</Link>
          {signupReady ? <Link href={signupHref} className={`btn btn-primary ${styles.ctaSmall}`}>Começar</Link> : null}
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>GITHUB ENGINEERING INTELLIGENCE</p>
          <h1>Entenda a engenharia por trás do repositório.</h1>
          <p>RepoScope transforma evidências públicas do GitHub em uma leitura estruturada de arquitetura, stack, dependências e maturidade de engenharia para recrutadores, Tech Leads e equipes de tecnologia.</p>
          <div className={styles.heroActions}>
            <Link className="btn btn-primary" href={signupReady ? signupHref : loginHref}>{signupReady ? 'Criar conta e liberar acesso' : 'Entrar na sua conta'}</Link>
            <a className="btn btn-outline" href="#exemplo">Ver exemplo de avaliação</a>
          </div>
        </div>
        <div className={`card ${styles.heroPanel}`}>
          <div className={styles.panelTop}><span>ANÁLISE TÉCNICA</span><b className="badge badge-soft">Exemplo ilustrativo</b></div>
          <div className={styles.repo}><div className={styles.repoIcon}><BookMarked aria-hidden="true" /></div><div><small>acme-labs</small><strong>commerce-api</strong><p>API de e-commerce com arquitetura modular.</p></div></div>
          <div className={styles.metrics}><div><span>Qualidade</span><strong>87%</strong></div><div><span>Stack</span><strong>8</strong></div><div><span>Camadas</span><strong>4</strong></div></div>
          <div className={styles.stack}><span className="badge badge-soft badge-primary">TypeScript</span><span className="badge badge-soft badge-primary">NestJS</span><span className="badge badge-soft badge-primary">PostgreSQL</span><span className="badge badge-soft badge-primary">Docker</span><span className="badge badge-soft badge-primary">GitHub Actions</span></div>
          <progress className={`progress progress-primary ${styles.bar}`} value={87} max={100} aria-label="Qualidade do exemplo: 87%" />
          <small className={styles.demoNote}>Dados fictícios usados apenas para demonstrar a experiência do produto.</small>
        </div>
      </section>

      <section className={styles.audience}>
        <article><small>RECRUTAMENTO</small><h2>Triagem técnica com evidências</h2><p>Tenha contexto técnico antes de envolver engenharia, sem transformar o score em decisão automática de contratação.</p></article>
        <article><small>TECH LEADS</small><h2>Leitura arquitetural rápida</h2><p>Identifique stack, estrutura, CI, testes, dependências e sinais de manutenção antes da revisão aprofundada.</p></article>
        <article><small>EMPRESAS</small><h2>Critérios consistentes</h2><p>Use o mesmo conjunto de sinais observáveis ao revisar projetos e portfólios públicos.</p></article>
      </section>

      <section className={styles.how} id="como-funciona">
        <div className={styles.sectionHeading}><p>COMO FUNCIONA</p><h2>{signupReady ? 'Do cadastro à avaliação em três etapas.' : 'Do acesso à avaliação em três etapas.'}</h2></div>
        <div className={styles.steps}>
          <article><span>01</span><h3>{signupReady ? 'Crie sua conta' : 'Entre na sua conta'}</h3><p>{signupReady ? authMethods : 'E-mail e senha.'}</p></article>
          <article><span>02</span><h3>Ative o plano</h3><p>Sua conta começa com 1 análise válida gratuita. Depois disso, o acesso continua por pagamento seguro.</p></article>
          <article><span>03</span><h3>Analise</h3><p>Preencha o owner e o nome do repositório; o RepoScope monta automaticamente a URL https://github.com/owner/repositorio.</p></article>
        </div>
      </section>

      <section className={styles.example} id="exemplo">
        <div className={styles.sectionHeading}><p>EXEMPLO DE RESULTADO</p><h2>Veja o tipo de evidência entregue pela avaliação.</h2><span>Exemplo fictício. O produto real lê os sinais disponíveis no repositório informado pelo assinante.</span></div>
        <div className={styles.exampleGrid}>
          <div className={`card ${styles.scoreCard}`}><small>SCORE DE SINAIS TÉCNICOS</small><strong>87%</strong><p>5 de 6 grupos de evidência encontrados ou parcialmente atendidos.</p><progress className={`progress progress-primary ${styles.scoreBar}`} value={87} max={100} aria-label="Qualidade do exemplo: 87%" /></div>
          <div className={`card ${styles.signalCard}`}>{signals.map(([label, status, ok]) => <div key={label}><span className={ok ? styles.ok : styles.warn}>{ok ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}</span><strong>{label}</strong><small>{status}</small></div>)}</div>
        </div>
        <div className={styles.outputGrid}>
          <article className="card"><small>ARQUITETURA</small><h3>4 camadas detectadas</h3><p>API → serviços → persistência → infraestrutura, com tecnologias vinculadas às evidências do código.</p></article>
          <article className="card"><small>DEPENDÊNCIAS</small><h3>42 pacotes mapeados</h3><p>Separação entre runtime e desenvolvimento, versão declarada e manifesto de origem.</p></article>
          <article className="card"><small>REPOSITÓRIO</small><h3>Estrutura técnica detalhada</h3><p>Explore arquivos, dependências, stack, arquitetura e sinais observáveis do repositório analisado.</p></article>
        </div>
      </section>

      <section className={styles.sales}>
        <div>
          <p>PRONTO PARA USAR?</p>
          <h2>Pare de abrir dezenas de arquivos para entender o primeiro nível de um projeto.</h2>
          <span>{signupReady ? 'Crie sua conta, confirme seu e-mail e faça 1 análise válida gratuita antes de ativar o plano.' : 'Entre na sua conta para continuar seu acesso ao RepoScope.'}</span>
        </div>
        <Link className="btn btn-primary" href={signupReady ? signupHref : loginHref}>{signupReady ? 'Começar agora' : 'Entrar'}</Link>
      </section>

      <footer className={styles.footer}><strong>RepoScope</strong><span>Engineering intelligence baseada em sinais observáveis de repositórios públicos. Não substitui entrevista técnica, contexto de projeto ou avaliação humana.</span></footer>
    </main>
  );
}
