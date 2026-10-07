'use client';

import { ArrowUpRight, CircleHelp } from 'lucide-react';
import { buildCorrectionPlan } from '@/lib/correction-plan';
import type { RepositoryAnalysis } from '@/types/repository';

export function CorrectionPlanView({ data }: { data: RepositoryAnalysis }) {
  const plan = buildCorrectionPlan(
    data.qualitySignals,
    data.appliedCriteriaIds,
    data.languages.map((language) => language.name),
  );

  return (
    <div className="analysis-content correction-plan">
      <section className="correction-plan-hero card">
        <div>
          <p>PLANO DE CORREÇÃO</p>
          <h2>{plan.items.length ? `${plan.items.length} ação(ões) para buscar 100%` : 'Nenhuma correção pontuável pendente'}</h2>
          <span>Ordenação por risco técnico e impacto estimado na nota.</span>
        </div>
        <div className="correction-score">
          <strong>{plan.currentScore}%</strong>
          <span>→ {plan.targetScore}%</span>
        </div>
      </section>

      {plan.unavailable.length ? (
        <div className="alert alert-info correction-unavailable">
          <CircleHelp aria-hidden="true" />
          <span>
            {plan.unavailable.length} critério(s) dependem de evidência externa indisponível e não foram penalizados na nota.
          </span>
        </div>
      ) : null}

      <section className="correction-list">
        {plan.items.map((item, index) => (
          <details className="collapse collapse-arrow card correction-item" key={item.criterionId}>
            <summary className="collapse-title">
              <span className="correction-order">{String(index + 1).padStart(2, '0')}</span>
              <span className="correction-main">
                <strong>{item.label}</strong>
                <small>{item.currentDetail}</small>
              </span>
              <span className={`badge badge-soft priority-${item.priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>
                {item.priority}
              </span>
              <b>+{item.impactPoints} p.p.</b>
            </summary>
            <div className="collapse-content">
              <p>{item.action}</p>
              {item.evidence.length ? (
                <div className="correction-evidence">
                  {item.evidence.slice(0, 5).map((evidence, evidenceIndex) => (
                    <div key={`${evidence.label}-${evidenceIndex}`}>
                      <span>{evidence.label}</span>
                      {evidence.path ? <code>{evidence.path}</code> : null}
                      {evidence.url ? (
                        <a href={evidence.url} target="_blank" rel="noreferrer">
                          Abrir <ArrowUpRight aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        ))}
        {!plan.items.length ? (
          <div className="card empty-landing dashboard-empty">
            <h2>O perfil selecionado já está em 100%.</h2>
            <p>Critérios indisponíveis para consulta externa continuam exibidos separadamente e não reduzem a nota.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
