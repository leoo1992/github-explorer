import {
  QUALITY_CRITERIA,
  filterQualityCriteriaIdsForLanguages,
} from '@/lib/quality-criteria';
import type { QualityEvidence, QualitySignal } from '@/types/repository';

export type CorrectionPriority = 'Crítica' | 'Alta' | 'Média' | 'Baixa';

export type CorrectionPlanItem = {
  criterionId: string;
  label: string;
  group: string;
  priority: CorrectionPriority;
  impactPoints: number;
  currentDetail: string;
  action: string;
  evidence: QualityEvidence[];
};

const PRIORITY_WEIGHT: Record<CorrectionPriority, number> = {
  Crítica: 4,
  Alta: 3,
  Média: 2,
  Baixa: 1,
};

function priorityForGroup(group: string): CorrectionPriority {
  if (group === 'Segurança') return 'Crítica';
  if (group === 'Entrega' || group === 'Testes') return 'Alta';
  if (group === 'Qualidade') return 'Média';
  return 'Baixa';
}

export function buildCorrectionPlan(
  signals: QualitySignal[],
  criteriaIds: Iterable<string>,
  languages: Iterable<string>,
) {
  const applicableIds = new Set(
    filterQualityCriteriaIdsForLanguages(criteriaIds, languages),
  );
  const criterionById = new Map(
    QUALITY_CRITERIA.map((criterion) => [criterion.id, criterion]),
  );

  const scoredSignals = signals.filter((signal) => {
    if (signal.status === 'unknown') return false;
    if (signal.criterionId) return applicableIds.has(signal.criterionId);
    return QUALITY_CRITERIA.some(
      (criterion) =>
        applicableIds.has(criterion.id) && criterion.label === signal.label,
    );
  });

  const passed = scoredSignals.filter((signal) => signal.found).length;
  const total = scoredSignals.length;
  const currentScore = total ? Math.round((passed / total) * 100) : 0;

  const items = scoredSignals
    .filter((signal) => !signal.found)
    .flatMap((signal): CorrectionPlanItem[] => {
      const criterion = signal.criterionId
        ? criterionById.get(signal.criterionId)
        : QUALITY_CRITERIA.find(
            (candidate) =>
              applicableIds.has(candidate.id) &&
              candidate.label === signal.label,
          );
      if (!criterion) return [];

      const scoreAfterOneFix = total
        ? Math.round(((passed + 1) / total) * 100)
        : currentScore;
      return [
        {
          criterionId: criterion.id,
          label: criterion.label,
          group: criterion.group,
          priority: priorityForGroup(criterion.group),
          impactPoints: Math.max(0, scoreAfterOneFix - currentScore),
          currentDetail: signal.detail,
          action:
            signal.remediation ??
            `Atenda ao critério “${criterion.label}”: ${criterion.description}`,
          evidence: signal.evidence ?? [],
        },
      ];
    })
    .sort((a, b) => {
      const priority =
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priority !== 0) return priority;
      if (b.impactPoints !== a.impactPoints) {
        return b.impactPoints - a.impactPoints;
      }
      return a.label.localeCompare(b.label);
    });

  const unavailable = signals.filter((signal) => {
    if (signal.status !== 'unknown') return false;
    return signal.criterionId ? applicableIds.has(signal.criterionId) : true;
  });

  return {
    currentScore,
    targetScore: 100,
    passed,
    total,
    missing: items.length,
    items,
    unavailable,
  };
}
