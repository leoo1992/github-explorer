import type { QualitySignal } from '@/types/repository';

export type QualityCriterionGroup = 'Segurança' | 'Documentação' | 'Entrega' | 'Qualidade' | 'Testes';

export type QualityCriterion = {
  id: string;
  label: string;
  group: QualityCriterionGroup;
  description: string;
};

export const QUALITY_CRITERIA: QualityCriterion[] = [
  { id: 'no-sensitive-files', label: 'Sem arquivos sensíveis', group: 'Segurança', description: 'Não versiona arquivos com nomes associados a segredos ou credenciais.' },
  { id: 'gitignore', label: '.gitignore adequado', group: 'Segurança', description: 'Ignora segredos, dependências e artefatos gerados.' },
  { id: 'readme', label: 'README', group: 'Documentação', description: 'Documentação principal do projeto.' },
  { id: 'env-example', label: '.env.example', group: 'Documentação', description: 'Exemplo seguro das variáveis de ambiente.' },
  { id: 'architecture', label: 'Arquitetura', group: 'Documentação', description: 'Documento de arquitetura ou ADR.' },
  { id: 'license', label: 'LICENSE', group: 'Documentação', description: 'Licença declarada no repositório.' },
  { id: 'docker-safe', label: 'Docker seguro', group: 'Entrega', description: 'Imagem versionada, usuário não-root e sem segredo hardcoded.' },
  { id: 'dockerfile', label: 'Dockerfile', group: 'Entrega', description: 'Containerização versionada no repositório.' },
  { id: 'pipeline-green', label: 'Pipeline completo verde', group: 'Entrega', description: 'Último pipeline de qualidade detectado terminou com sucesso.' },
  { id: 'github-actions', label: 'GitHub Actions', group: 'Entrega', description: 'Workflow de automação presente.' },
  { id: 'lockfile', label: 'Lockfile', group: 'Entrega', description: 'Dependências reproduzíveis por lockfile.' },
  { id: 'tests-exist', label: 'Testes existentes', group: 'Testes', description: 'Arquivos ou framework de testes detectados.' },
  { id: 'lint-pass', label: 'Lint realmente passa', group: 'Qualidade', description: 'Execução de lint aprovada no CI.' },
  { id: 'lint-configured', label: 'Lint configurado', group: 'Qualidade', description: 'Ferramenta ou configuração de lint detectada.' },
  { id: 'type-checking', label: 'Type checking', group: 'Qualidade', description: 'Verificação estática de tipos configurada.' },
  { id: 'formatter', label: 'Formatter', group: 'Qualidade', description: 'Formatter ou configuração equivalente detectada.' },
  { id: 'dead-code', label: 'Código morto', group: 'Qualidade', description: 'Verificação de código ou exports não utilizados configurada.' },
  { id: 'coverage-80', label: 'Cobertura ≥ 80%', group: 'Testes', description: 'Limiar explícito de cobertura de ao menos 80%.' },
  { id: 'tests-pass', label: 'Testes passam', group: 'Testes', description: 'Testes aprovados no CI.' },
  { id: 'build-pass', label: 'Build passa', group: 'Entrega', description: 'Build aprovado no CI.' },
];

const BY_ID = new Map(QUALITY_CRITERIA.map((criterion) => [criterion.id, criterion]));

export const QUALITY_PRESETS: Record<string, { label: string; ids: string[] }> = {
  complete: {
    label: 'Completa',
    ids: QUALITY_CRITERIA.map((criterion) => criterion.id),
  },
  essential: {
    label: 'Essencial',
    ids: ['no-sensitive-files', 'gitignore', 'readme', 'license', 'lockfile', 'tests-exist', 'lint-configured', 'type-checking', 'build-pass'],
  },
  delivery: {
    label: 'CI / Entrega',
    ids: ['docker-safe', 'dockerfile', 'pipeline-green', 'github-actions', 'lockfile', 'lint-pass', 'tests-pass', 'build-pass'],
  },
  documentation: {
    label: 'Documentação',
    ids: ['readme', 'env-example', 'architecture', 'license'],
  },
};

export const DEFAULT_QUALITY_CRITERIA_IDS = QUALITY_PRESETS.complete.ids;

export function sanitizeQualityCriteriaIds(ids?: Iterable<string> | null) {
  if (!ids) return [...DEFAULT_QUALITY_CRITERIA_IDS];
  const selected = [...new Set([...ids].filter((id) => BY_ID.has(id)))];
  return selected.length ? selected : [...DEFAULT_QUALITY_CRITERIA_IDS];
}

export function qualityCriterionLabels(ids?: Iterable<string> | null) {
  return new Set(sanitizeQualityCriteriaIds(ids).map((id) => BY_ID.get(id)!.label));
}

export function calculateQualityScore(signals: QualitySignal[], ids?: Iterable<string> | null) {
  const labels = qualityCriterionLabels(ids);
  const scored = signals.filter((signal) => labels.has(signal.label));
  if (!scored.length) return { score: 0, passed: 0, total: 0 };
  const passed = scored.filter((signal) => signal.found).length;
  return {
    score: Math.round((passed / scored.length) * 100),
    passed,
    total: scored.length,
  };
}
