'use client';

import { ShieldAlert, ShieldCheck, Signature, Siren } from 'lucide-react';
import { QUALITY_CRITERIA } from '@/lib/quality-criteria';
import type { RepositoryAnalysis } from '@/types/repository';
import { QualityEvidencePanel } from '@/components/quality-evidence-panel';

export function SecurityView({ data }: { data: RepositoryAnalysis }) {
  const securityIds = QUALITY_CRITERIA
    .filter((criterion) => criterion.group === 'Segurança')
    .map((criterion) => criterion.id);

  const alerts = data.security.dependencyAlerts;

  return (
    <div className="analysis-content security-view">
      <section className="metric-grid security-metrics">
        <article className="card">
          <span>CodeQL</span>
          <strong>{data.security.codeql ? 'Ativo' : 'Ausente'}</strong>
          <small>SAST específico do GitHub</small>
        </article>
        <article className="card">
          <span>Dependabot</span>
          <strong>{data.security.dependabot ? 'Ativo' : 'Ausente'}</strong>
          <small>Atualização automática</small>
        </article>
        <article className="card">
          <span>Commits verificados</span>
          <strong>{data.security.signedCommits.verified}/{data.security.signedCommits.total}</strong>
          <small>amostra recente</small>
        </article>
        <article className="card">
          <span>Advisories abertos</span>
          <strong>{alerts.available ? alerts.open : '—'}</strong>
          <small>{alerts.available ? 'Dependabot alerts' : 'API indisponível'}</small>
        </article>
      </section>

      <section className="security-summary-grid">
        <article className="card panel">
          <div className="panel-head">
            <div><p>GitHub Actions</p><h2>Privilégio mínimo</h2></div>
            {data.security.actionsPermissionsExplicit ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          </div>
          <p className="muted">
            {data.security.actionsPermissionsExplicit
              ? 'Os workflows analisados declaram permissions explicitamente e não usam write-all.'
              : 'Revise os workflows: existe ausência de permissions explícitas ou uso amplo de escrita.'}
          </p>
        </article>

        <article className="card panel">
          <div className="panel-head">
            <div><p>Secrets</p><h2>Indicadores encontrados</h2></div>
            {data.security.secretIndicators.length ? <Siren aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
          </div>
          {data.security.secretIndicators.length ? (
            <ul className="security-indicator-list">
              {data.security.secretIndicators.map((indicator) => <li key={indicator}>{indicator}</li>)}
            </ul>
          ) : <p className="muted">Nenhum padrão conhecido foi detectado na amostra de configuração e workflows.</p>}
        </article>

        <article className="card panel">
          <div className="panel-head">
            <div><p>Assinatura</p><h2>Commits recentes</h2></div>
            <Signature aria-hidden="true" />
          </div>
          <p className="muted">
            {data.security.signedCommits.total
              ? `${data.security.signedCommits.verified} de ${data.security.signedCommits.total} commits recentes possuem verificação de assinatura no GitHub.`
              : 'A amostra de commits não pôde ser consultada.'}
          </p>
        </article>

        <article className="card panel">
          <div className="panel-head">
            <div><p>Advisories</p><h2>Dependências vulneráveis</h2></div>
            {alerts.available && alerts.open === 0 ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
          </div>
          <p className="muted">
            {!alerts.available
              ? 'A API de Dependabot Alerts não está disponível para o token/repositório; o critério fica fora da nota.'
              : alerts.open === 0
                ? 'Nenhum alerta aberto foi retornado.'
                : `${alerts.open} alerta(s) aberto(s). GHSA: ${alerts.advisories.slice(0, 6).join(', ') || 'sem identificador'}`}
          </p>
        </article>
      </section>

      <QualityEvidencePanel
        signals={data.qualitySignals}
        criteriaIds={securityIds}
        languages={data.languages.map((language) => language.name)}
        profile="Segurança aprofundada"
      />
    </div>
  );
}
