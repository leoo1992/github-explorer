'use client';

import { Check, CircleHelp, ExternalLink, Minus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { qualityCriterionLabels } from '@/lib/quality-criteria';
import type { QualitySignal } from '@/types/repository';

export function QualityEvidencePanel({
  signals,
  criteriaIds,
  languages,
  profile,
}: {
  signals: QualitySignal[];
  criteriaIds: string[];
  languages: string[];
  profile?: string;
}) {
  const [selected, setSelected] = useState<QualitySignal | null>(null);
  const labels = useMemo(
    () => qualityCriterionLabels(criteriaIds, languages),
    [criteriaIds, languages],
  );
  const visible = signals.filter((signal) => labels.has(signal.label));

  return (
    <>
      <article className="card panel wide quality-evidence-panel">
        <div className="panel-head">
          <div>
            <p>Engineering signals</p>
            <h2>Critérios considerados na nota</h2>
            {profile ? <small className="quality-profile-label">{profile}</small> : null}
          </div>
          <span className="badge badge-soft badge-primary criteria-count">
            {visible.filter((signal) => signal.status !== 'unknown').length} pontuáveis
          </span>
        </div>

        <div className="quality-grid">
          {visible.map((signal) => {
            const unknown = signal.status === 'unknown';
            return (
              <button
                className={[
                  'quality-card',
                  signal.found ? 'quality-ok' : '',
                  unknown ? 'quality-unknown' : '',
                ].filter(Boolean).join(' ')}
                key={signal.criterionId ?? signal.label}
                type="button"
                onClick={() => setSelected(signal)}
                aria-label={`Ver evidências de ${signal.label}`}
              >
                <span>
                  {unknown ? <CircleHelp aria-hidden="true" /> : signal.found ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}
                </span>
                <div>
                  <strong>{signal.label}</strong>
                  <small>{signal.detail}</small>
                </div>
              </button>
            );
          })}
        </div>
      </article>

      {selected ? (
        <dialog className="modal quality-evidence-modal" open onClick={(event) => {
          if (event.currentTarget === event.target) setSelected(null);
        }}>
          <div className="modal-box">
            <div className="evidence-modal-head">
              <div>
                <p>EVIDÊNCIA DO CRITÉRIO</p>
                <h3>{selected.label}</h3>
              </div>
              <button className="btn btn-ghost btn-sm btn-square" type="button" onClick={() => setSelected(null)} aria-label="Fechar">
                <X aria-hidden="true" />
              </button>
            </div>

            <div className={[
              'alert',
              selected.status === 'unknown'
                ? 'alert-info'
                : selected.found
                  ? 'alert-success'
                  : 'alert-error',
            ].join(' ')}>
              <span>
                {selected.status === 'unknown'
                  ? 'A evidência externa não pôde ser consultada; este critério não entra na nota.'
                  : selected.found
                    ? 'Critério atendido.'
                    : 'Critério não atendido.'}
                {' '}{selected.detail}
              </span>
            </div>

            <div className="evidence-list-detailed">
              {(selected.evidence ?? []).map((evidence, index) => (
                <article key={`${evidence.label}-${evidence.path ?? index}`}>
                  <div>
                    <strong>{evidence.label}</strong>
                    <span className={evidence.positive === false ? 'badge badge-soft badge-error' : 'badge badge-soft badge-success'}>
                      {evidence.positive === false ? 'Falha' : 'Evidência'}
                    </span>
                  </div>
                  {evidence.path ? <code>{evidence.path}</code> : null}
                  {evidence.detail ? <small>{evidence.detail}</small> : null}
                  {evidence.url ? (
                    <a className="btn btn-ghost btn-xs" href={evidence.url} target="_blank" rel="noreferrer">
                      Abrir evidência <ExternalLink aria-hidden="true" />
                    </a>
                  ) : null}
                </article>
              ))}
              {!selected.evidence?.length ? (
                <p className="muted">Nenhuma evidência detalhada adicional foi registrada.</p>
              ) : null}
            </div>

            {selected.remediation && !selected.found ? (
              <div className="evidence-remediation">
                <strong>Como corrigir</strong>
                <p>{selected.remediation}</p>
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
