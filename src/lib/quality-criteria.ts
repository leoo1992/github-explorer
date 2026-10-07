import type { QualitySignal } from '@/types/repository';

export type QualityCriterionGroup =
  | 'Segurança'
  | 'Documentação'
  | 'Entrega'
  | 'Qualidade'
  | 'Testes'
  | 'Governança';

export const QUALITY_LANGUAGES = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C#',
  'Go',
  'Rust',
  'PHP',
  'Ruby',
  'Kotlin',
  'Swift',
  'Dart',
  'C',
  'C++',
] as const;

export type QualityLanguage = (typeof QUALITY_LANGUAGES)[number];

export type QualityCriterion = {
  id: string;
  label: string;
  group: QualityCriterionGroup;
  description: string;
  languages?: readonly QualityLanguage[];
};

const GLOBAL = undefined;

export const QUALITY_CRITERIA: QualityCriterion[] = [
  { id: 'no-sensitive-files', label: 'Sem arquivos sensíveis', group: 'Segurança', description: 'Não versiona arquivos com nomes associados a segredos ou credenciais.', languages: GLOBAL },
  { id: 'gitignore', label: '.gitignore adequado', group: 'Segurança', description: 'Ignora segredos, dependências e artefatos gerados.', languages: GLOBAL },
  { id: 'readme', label: 'README', group: 'Documentação', description: 'Documentação principal do projeto.', languages: GLOBAL },
  { id: 'env-example', label: '.env.example', group: 'Documentação', description: 'Exemplo seguro das variáveis de ambiente.', languages: GLOBAL },
  { id: 'architecture', label: 'Arquitetura', group: 'Documentação', description: 'Documento de arquitetura ou ADR.', languages: GLOBAL },
  { id: 'license', label: 'LICENSE', group: 'Documentação', description: 'Licença declarada no repositório.', languages: GLOBAL },
  { id: 'docker-safe', label: 'Docker seguro', group: 'Entrega', description: 'Imagem versionada, usuário não-root e sem segredo hardcoded.', languages: GLOBAL },
  { id: 'dockerfile', label: 'Dockerfile', group: 'Entrega', description: 'Containerização versionada no repositório.', languages: GLOBAL },
  { id: 'pipeline-green', label: 'Pipeline completo verde', group: 'Entrega', description: 'Último pipeline de qualidade detectado terminou com sucesso.', languages: GLOBAL },
  { id: 'github-actions', label: 'GitHub Actions', group: 'Entrega', description: 'Workflow de automação presente.', languages: GLOBAL },
  { id: 'lockfile', label: 'Lockfile', group: 'Entrega', description: 'Dependências reproduzíveis por lockfile.', languages: GLOBAL },
  { id: 'tests-exist', label: 'Testes existentes', group: 'Testes', description: 'Arquivos ou framework de testes detectados.', languages: GLOBAL },
  { id: 'lint-pass', label: 'Lint realmente passa', group: 'Qualidade', description: 'Execução de lint aprovada no CI.', languages: GLOBAL },
  { id: 'lint-configured', label: 'Lint configurado', group: 'Qualidade', description: 'Ferramenta ou configuração de lint detectada.', languages: GLOBAL },
  {
    id: 'type-checking',
    label: 'Type checking',
    group: 'Qualidade',
    description: 'Verificação estática de tipos configurada quando a linguagem depende de ferramenta adicional.',
    languages: ['JavaScript', 'TypeScript', 'Python', 'PHP', 'Ruby'],
  },
  { id: 'formatter', label: 'Formatter', group: 'Qualidade', description: 'Formatter ou configuração equivalente detectada.', languages: GLOBAL },
  { id: 'dead-code', label: 'Código morto', group: 'Qualidade', description: 'Verificação de código ou exports não utilizados configurada.', languages: GLOBAL },
  { id: 'coverage-80', label: 'Cobertura ≥ 80%', group: 'Testes', description: 'Limiar explícito de cobertura de ao menos 80%.', languages: GLOBAL },
  { id: 'tests-pass', label: 'Testes passam', group: 'Testes', description: 'Testes aprovados no CI.', languages: GLOBAL },
  { id: 'build-pass', label: 'Build passa', group: 'Entrega', description: 'Build aprovado no CI.', languages: GLOBAL },

  { id: 'codeowners', label: 'CODEOWNERS', group: 'Governança', description: 'Responsáveis por áreas do código estão declarados.', languages: GLOBAL },
  { id: 'security-policy', label: 'SECURITY.md', group: 'Segurança', description: 'Política para reporte responsável de vulnerabilidades.', languages: GLOBAL },
  { id: 'dependency-updates', label: 'Atualização automática de dependências', group: 'Segurança', description: 'Dependabot ou Renovate configurado.', languages: GLOBAL },
  { id: 'sast', label: 'SAST no CI', group: 'Segurança', description: 'CodeQL, Semgrep ou ferramenta equivalente executada no CI.', languages: GLOBAL },
  { id: 'secret-scanning', label: 'Varredura de segredos no CI', group: 'Segurança', description: 'Gitleaks, TruffleHog ou ferramenta equivalente automatizada.', languages: GLOBAL },
  { id: 'dependency-audit', label: 'Auditoria de dependências', group: 'Segurança', description: 'Pipeline executa auditoria de vulnerabilidades em dependências.', languages: GLOBAL },
  { id: 'contributing', label: 'CONTRIBUTING', group: 'Documentação', description: 'Guia de contribuição presente.', languages: GLOBAL },
  { id: 'changelog', label: 'CHANGELOG', group: 'Documentação', description: 'Histórico de mudanças versionado.', languages: GLOBAL },
  { id: 'pr-template', label: 'Template de Pull Request', group: 'Governança', description: 'Template orienta descrição e validação de mudanças.', languages: GLOBAL },
  { id: 'issue-templates', label: 'Templates de Issue', group: 'Governança', description: 'Templates ou formulários estruturam abertura de issues.', languages: GLOBAL },
  { id: 'release-automation', label: 'Automação de release', group: 'Entrega', description: 'Release Please, semantic-release ou automação equivalente.', languages: GLOBAL },
  { id: 'integration-tests', label: 'Testes de integração', group: 'Testes', description: 'Suite ou convenção explícita para testes de integração.', languages: GLOBAL },
  { id: 'e2e-tests', label: 'Testes E2E', group: 'Testes', description: 'Suite de testes end-to-end detectada.', languages: GLOBAL },

  { id: 'typescript-strict', label: 'TypeScript strict', group: 'Qualidade', description: 'tsconfig habilita modo strict.', languages: ['TypeScript'] },
  { id: 'node-engine', label: 'Node.js engine declarado', group: 'Entrega', description: 'package.json restringe a versão suportada do Node.js.', languages: ['JavaScript', 'TypeScript'] },
  { id: 'python-typing', label: 'Tipagem Python', group: 'Qualidade', description: 'mypy, Pyright ou configuração de tipagem estática presente.', languages: ['Python'] },
  { id: 'jvm-quality', label: 'Qualidade JVM', group: 'Qualidade', description: 'Checkstyle, SpotBugs, Detekt, ktlint ou ferramenta equivalente.', languages: ['Java', 'Kotlin'] },
  { id: 'dotnet-analyzers', label: 'Nullable + analyzers .NET', group: 'Qualidade', description: 'Nullable reference types e/ou analyzers estão habilitados.', languages: ['C#'] },
  { id: 'go-static-analysis', label: 'Análise estática Go', group: 'Qualidade', description: 'go vet, staticcheck ou golangci-lint detectado.', languages: ['Go'] },
  { id: 'rust-quality', label: 'Clippy + rustfmt', group: 'Qualidade', description: 'Clippy e rustfmt fazem parte do fluxo de qualidade.', languages: ['Rust'] },
  { id: 'php-static-analysis', label: 'PHPStan / Psalm', group: 'Qualidade', description: 'Análise estática PHP configurada.', languages: ['PHP'] },
  { id: 'ruby-lint', label: 'RuboCop', group: 'Qualidade', description: 'RuboCop configurado ou executado no projeto.', languages: ['Ruby'] },
  { id: 'swift-lint', label: 'SwiftLint', group: 'Qualidade', description: 'SwiftLint configurado ou executado no projeto.', languages: ['Swift'] },
  { id: 'dart-analysis', label: 'Dart analyzer', group: 'Qualidade', description: 'analysis_options.yaml ou dart analyze detectado.', languages: ['Dart'] },
  { id: 'native-static-analysis', label: 'Análise estática C/C++', group: 'Qualidade', description: 'clang-tidy, cppcheck ou ferramenta equivalente detectada.', languages: ['C', 'C++'] },
];

const BY_ID = new Map(QUALITY_CRITERIA.map((criterion) => [criterion.id, criterion]));
const LANGUAGE_BY_LOWER = new Map(
  QUALITY_LANGUAGES.map((language) => [language.toLowerCase(), language]),
);

export const LIVE_CI_CRITERIA_IDS = new Set([
  'pipeline-green',
  'lint-pass',
  'tests-pass',
  'build-pass',
]);

export const QUALITY_PRESETS: Record<string, { label: string; ids: string[] }> = {
  complete: {
    label: 'Completa',
    ids: QUALITY_CRITERIA.map((criterion) => criterion.id),
  },
  essential: {
    label: 'Essencial',
    ids: ['no-sensitive-files', 'gitignore', 'readme', 'license', 'lockfile', 'tests-exist', 'lint-configured', 'build-pass'],
  },
  security: {
    label: 'Segurança',
    ids: ['no-sensitive-files', 'gitignore', 'security-policy', 'dependency-updates', 'sast', 'secret-scanning', 'dependency-audit'],
  },
  delivery: {
    label: 'CI / Entrega',
    ids: ['docker-safe', 'dockerfile', 'pipeline-green', 'github-actions', 'lockfile', 'lint-pass', 'tests-pass', 'build-pass', 'release-automation'],
  },
  documentation: {
    label: 'Documentação',
    ids: ['readme', 'env-example', 'architecture', 'license', 'contributing', 'changelog'],
  },
  testing: {
    label: 'Testes',
    ids: ['tests-exist', 'integration-tests', 'e2e-tests', 'coverage-80', 'tests-pass'],
  },
};

export const DEFAULT_QUALITY_CRITERIA_IDS = QUALITY_PRESETS.complete.ids;

export function sanitizeQualityLanguage(value?: string | null): QualityLanguage | null {
  if (!value) return null;
  return LANGUAGE_BY_LOWER.get(value.trim().toLowerCase()) ?? null;
}

export function sanitizeQualityCriteriaIds(ids?: Iterable<string> | null) {
  if (!ids) return [...DEFAULT_QUALITY_CRITERIA_IDS];
  const selected = [...new Set([...ids].filter((id) => BY_ID.has(id)))];
  return selected.length ? selected : [...DEFAULT_QUALITY_CRITERIA_IDS];
}

function normalizedLanguages(languages?: Iterable<string> | null) {
  if (languages === undefined || languages === null) return null;
  return new Set(
    [...languages]
      .map((language) => sanitizeQualityLanguage(language))
      .filter((language): language is QualityLanguage => Boolean(language)),
  );
}

export function criterionAppliesToLanguages(
  criterion: QualityCriterion,
  languages?: Iterable<string> | null,
) {
  if (!criterion.languages?.length) return true;
  const normalized = normalizedLanguages(languages);
  if (normalized === null) return true;
  return criterion.languages.some((language) => normalized.has(language));
}

export function filterQualityCriteriaIdsForLanguages(
  ids: Iterable<string>,
  languages?: Iterable<string> | null,
) {
  return sanitizeQualityCriteriaIds(ids).filter((id) => {
    const criterion = BY_ID.get(id);
    return criterion ? criterionAppliesToLanguages(criterion, languages) : false;
  });
}

export function qualityCriteriaForLanguage(language: QualityLanguage) {
  return QUALITY_CRITERIA
    .filter((criterion) => criterionAppliesToLanguages(criterion, [language]))
    .map((criterion) => criterion.id);
}

export function qualityCriterionLabels(
  ids?: Iterable<string> | null,
  languages?: Iterable<string> | null,
) {
  return new Set(
    filterQualityCriteriaIdsForLanguages(
      sanitizeQualityCriteriaIds(ids),
      languages,
    ).map((id) => BY_ID.get(id)!.label),
  );
}

export function requiresLiveCiEvidence(ids?: Iterable<string> | null) {
  return sanitizeQualityCriteriaIds(ids).some((id) => LIVE_CI_CRITERIA_IDS.has(id));
}

export function calculateQualityScore(
  signals: QualitySignal[],
  ids?: Iterable<string> | null,
  languages?: Iterable<string> | null,
) {
  const labels = qualityCriterionLabels(ids, languages);
  const scored = signals.filter((signal) => labels.has(signal.label));
  if (!scored.length) return { score: 0, passed: 0, total: 0 };
  const passed = scored.filter((signal) => signal.found).length;
  return {
    score: Math.round((passed / scored.length) * 100),
    passed,
    total: scored.length,
  };
}
