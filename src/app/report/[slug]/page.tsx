import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildCorrectionPlan } from '@/lib/correction-plan';
import { calculateQualityScore } from '@/lib/quality-criteria';
import { createAdminClient } from '@/lib/supabase/admin';
import { BrandIcon } from '@/components/brand-icon';
import { PrintOnLoad } from '@/components/print-on-load';
import { SharedReportActions } from '@/components/shared-report-actions';
import type { RepositoryAnalysis } from '@/types/repository';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Relatório RepoScope',
  description: 'Relatório técnico somente leitura gerado pelo RepoScope.',
  robots: { index: false, follow: false },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default async function SharedReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(slug)) notFound();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('shared_reports')
    .select('repository,quality_score,quality_profile,analysis,created_at,expires_at')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) notFound();
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) notFound();

  const analysis = data.analysis as unknown as RepositoryAnalysis;
  if (!analysis?.repository?.owner || !Array.isArray(analysis.qualitySignals)) notFound();

  const quality = data.quality_score === null
    ? calculateQualityScore(
        analysis.qualitySignals,
        analysis.appliedCriteriaIds,
        analysis.languages.map((language) => language.name),
      ).score
    : Number(data.quality_score);

  const plan = buildCorrectionPlan(
    analysis.qualitySignals,
    analysis.appliedCriteriaIds,
    analysis.languages.map((language) => language.name),
  );

  return (
    <main className={styles.page}>
      <PrintOnLoad enabled={query.print === '1'} />

      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandIcon className={styles.brandIcon} />
          <span><strong>RepoScope</strong><small>Relatório compartilhado</small></span>
        </Link>
        <SharedReportActions analysis={analysis} />
      </header>

      <section className={styles.hero}>
        <div>
          <p>RELATÓRIO SOMENTE LEITURA</p>
          <h1>{analysis.repository.owner}/{analysis.repository.name}</h1>
          <span>{analysis.repository.description ?? 'Sem descrição cadastrada no GitHub.'}</span>
        </div>
        <div className={styles.score}>
          <strong>{quality}%</strong>
          <span>{analysis.qualityProfile}</span>
        </div>
      </section>

      <section className={styles.metrics}>
        <article><span>Arquivos</span><strong>{analysis.totals.files}</strong><small>{analysis.totals.directories} diretórios</small></article>
        <article><span>Stack</span><strong>{analysis.stack.length}</strong><small>tecnologias detectadas</small></article>
        <article><span>Critérios</span><strong>{analysis.appliedCriteriaIds.length}</strong><small>perfil aplicado</small></article>
        <article><span>Correções</span><strong>{plan.missing}</strong><small>para buscar 100%</small></article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><p>SEGURANÇA</p><h2>Postura técnica observada</h2></div>
        </div>
        <div className={styles.securityGrid}>
          <article><span>CodeQL</span><strong>{analysis.security?.codeql ? 'Ativo' : 'Ausente'}</strong></article>
          <article><span>Dependabot</span><strong>{analysis.security?.dependabot ? 'Ativo' : 'Ausente'}</strong></article>
          <article><span>Permissions</span><strong>{analysis.security?.actionsPermissionsExplicit ? 'Explícitas' : 'Revisar'}</strong></article>
          <article><span>Commits assinados</span><strong>{analysis.security?.signedCommits?.verified ?? 0}/{analysis.security?.signedCommits?.total ?? 0}</strong></article>
          <article><span>Alertas abertos</span><strong>{analysis.security?.dependencyAlerts?.available ? analysis.security.dependencyAlerts.open : '—'}</strong></article>
          <article><span>Secrets</span><strong>{analysis.security?.secretIndicators?.length ? analysis.security.secretIndicators.length : 0}</strong></article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><p>EVIDÊNCIAS</p><h2>Critérios e origem da avaliação</h2></div>
          <span>{analysis.qualitySignals.length} sinais coletados</span>
        </div>
        <div className={styles.signalList}>
          {analysis.qualitySignals.map((signal) => (
            <article key={signal.criterionId ?? signal.label}>
              <div className={styles.signalHead}>
                <div>
                  <strong>{signal.label}</strong>
                  <small>{signal.detail}</small>
                </div>
                <span className={[
                  'badge',
                  'badge-soft',
                  signal.status === 'unknown'
                    ? 'badge-info'
                    : signal.found
                      ? 'badge-success'
                      : 'badge-error',
                ].join(' ')}>
                  {signal.status === 'unknown' ? 'Indisponível' : signal.found ? 'Atende' : 'Falha'}
                </span>
              </div>
              {signal.evidence?.length ? (
                <div className={styles.evidence}>
                  {signal.evidence.slice(0, 6).map((item, index) => (
                    <div key={item.path ?? `${item.label}-${index}`}>
                      <span>{item.label}</span>
                      {item.path ? <code>{item.path}</code> : null}
                      {item.detail ? <small>{item.detail}</small> : null}
                      {item.url ? <a href={item.url} target="_blank" rel="noreferrer">Abrir evidência</a> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><p>PLANO DE CORREÇÃO</p><h2>Prioridades para chegar a 100%</h2></div>
          <span>{plan.currentScore}% → 100%</span>
        </div>
        <div className={styles.planList}>
          {plan.items.map((item, index) => (
            <article key={item.criterionId}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <div>
                <strong>{item.label}</strong>
                <small>{item.action}</small>
              </div>
              <span className="badge badge-soft">{item.priority}</span>
              <em>+{item.impactPoints} p.p.</em>
            </article>
          ))}
          {!plan.items.length ? <p className={styles.empty}>Nenhuma correção pontuável pendente.</p> : null}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Gerado em {formatDate(data.created_at)} · análise original em {formatDate(analysis.analyzedAt)}</span>
        <a href={analysis.repository.htmlUrl} target="_blank" rel="noreferrer">Abrir repositório no GitHub</a>
      </footer>
    </main>
  );
}
