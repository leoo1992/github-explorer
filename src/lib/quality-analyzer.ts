import type { DependencyItem, QualitySignal, TreeEntry } from '@/types/repository';

interface GitHubContent {
  content?: string;
  encoding?: string;
}

interface GitHubWorkflowRuns {
  workflow_runs: Array<{
    id: number;
    name: string;
    path: string;
    status: string;
    conclusion: string | null;
  }>;
}

interface GitHubWorkflowJobs {
  jobs: Array<{
    name: string;
    conclusion: string | null;
    steps?: Array<{ name: string; conclusion: string | null }>;
  }>;
}

type TextFile = { path: string; content: string };

type CiEvidence = {
  pipelinePassed: boolean;
  lintPassed: boolean;
  testsPassed: boolean;
  buildPassed: boolean;
  detail: string;
};

const LOCKFILES = new Set([
  'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock',
  'bun.lock', 'bun.lockb', 'poetry.lock', 'pdm.lock', 'uv.lock', 'pipfile.lock',
  'cargo.lock', 'go.sum', 'composer.lock', 'gemfile.lock', 'gradle.lockfile',
  'packages.lock.json', 'package.resolved', 'pubspec.lock', 'podfile.lock',
]);

function buildHeaders() {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'github-architecture-explorer',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubFetch<T>(url: string, headers: HeadersInit) {
  const response = await fetch(url, { headers, next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`GitHub respondeu com HTTP ${response.status}.`);
  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  const remaining = remainingHeader ? Number.parseInt(remainingHeader, 10) : null;
  return {
    data: (await response.json()) as T,
    remaining: Number.isFinite(remaining) ? remaining : null,
  };
}

async function githubFetchFresh<T>(url: string, headers: HeadersInit) {
  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`GitHub respondeu com HTTP ${response.status}.`);
  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  const remaining = remainingHeader ? Number.parseInt(remainingHeader, 10) : null;
  return {
    data: (await response.json()) as T,
    remaining: Number.isFinite(remaining) ? remaining : null,
  };
}

function decodeContent(content: GitHubContent) {
  if (!content.content || content.encoding !== 'base64') return null;
  return Buffer.from(content.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

async function fetchTextFile(base: string, path: string, ref: string, headers: HeadersInit) {
  try {
    const match = base.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)$/);
    if (match) {
      const [, owner, repo] = match;
      const rawUrl =
        `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/` +
        `${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(rawUrl, { next: { revalidate: 3600 } });
      if (!response.ok) return { file: null, remaining: null };
      return { file: { path, content: await response.text() }, remaining: null };
    }

    const result = await githubFetch<GitHubContent>(
      `${base}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`,
      headers,
    );
    const content = decodeContent(result.data);
    return { file: content === null ? null : { path, content }, remaining: result.remaining };
  } catch {
    return { file: null, remaining: null };
  }
}

function basename(path: string) {
  return path.toLowerCase().split('/').at(-1) ?? '';
}

function isSensitivePath(path: string) {
  const normalized = path.toLowerCase();
  const name = basename(normalized);
  const allowedEnv = /(^|\/)\.env(?:\.[^/]+)*\.(?:example|sample|template)$/.test(normalized);
  if (!allowedEnv && /(^|\/)\.env(?:\.|$)/.test(normalized)) return true;
  if (/^(id_rsa|id_ed25519|credentials\.json|service-account(?:\.json)?|secrets?\.(json|ya?ml))$/.test(name)) return true;
  return /\.(pem|key|p12|pfx|jks|keystore)$/.test(name);
}

function gitignoreIsAdequate(content: string | null, hasNode: boolean, hasPython: boolean) {
  if (!content) return false;
  const normalized = content.toLowerCase();
  const secrets = /(^|\n)\s*\.env(?:\.\*|\s*$)/m.test(normalized);
  const deps = hasNode
    ? /(^|\n)\s*node_modules\/?\s*$/m.test(normalized)
    : hasPython
      ? /(^|\n)\s*(\.venv|venv|__pycache__)\/?\s*$/m.test(normalized)
      : true;
  const generated = /(^|\n)\s*(\.next|dist|build|out|coverage|target)\/?\s*$/m.test(normalized);
  return secrets && deps && generated;
}

function dockerIsSafe(dockerfiles: TextFile[]) {
  if (!dockerfiles.length) return false;
  return dockerfiles.every(({ content }) => {
    const fromLines = content.match(/^\s*FROM\s+([^\s]+)/gim) ?? [];
    const pinned = fromLines.length > 0 && fromLines.every((line) => {
      const image = line.replace(/^\s*FROM\s+/i, '').trim().split(/\s+/)[0];
      return image === 'scratch' || image.includes('@sha256:') || (image.includes(':') && !image.endsWith(':latest'));
    });
    const users = [...content.matchAll(/^\s*USER\s+([^\s#]+)/gim)];
    const finalUser = users.at(-1)?.[1].toLowerCase() ?? null;
    const nonRoot = finalUser !== null && finalUser !== 'root' && finalUser !== '0';
    const hardcodedSecret = /^\s*(?:ENV|ARG)\s+[^\n]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY)\s*=\s*[^$\s][^\s#]*/gim.test(content);
    return pinned && nonRoot && !hardcodedSecret;
  });
}

function hasFormatter(deps: Set<string>, paths: string[], text: string) {
  return [
    'prettier', '@biomejs/biome', 'dprint', 'black', 'yapf', 'autopep8', 'isort', 'ruff',
    'php-cs-fixer', 'swiftformat',
  ].some((dep) => deps.has(dep)) ||
    paths.some((path) => /(^|\/)(\.prettierrc(?:\.[^/]+)?|prettier\.config\.[^/]+|biome\.json|dprint\.json|rustfmt\.toml|\.clang-format|\.editorconfig)$/i.test(path)) ||
    /\b(prettier|biome\s+format|dprint|black|ruff\s+format|gofmt|rustfmt|spotless|ktlint|google-java-format|php-cs-fixer|swiftformat|dart\s+format|clang-format)\b|\[tool\.ruff\.format\]/i.test(text);
}

function hasDeadCodeCheck(deps: Set<string>, paths: string[], text: string) {
  const dedicated = ['knip', 'ts-prune', 'unimported', 'vulture', 'deadcode'].some((dep) => deps.has(dep)) ||
    /\b(knip|ts-prune|unimported|vulture|deadcode)\b/i.test(text);
  const tsUnused = paths.some((path) => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(path)) &&
    /"(?:noUnusedLocals|noUnusedParameters)"\s*:\s*true/i.test(text);
  return dedicated || tsUnused;
}

function hasCoverage80(text: string) {
  const patterns = [
    /--cov-fail-under(?:=|\s+)(\d{1,3})/gi,
    /fail_under\s*=\s*(\d{1,3})/gi,
    /minimum_coverage\s*=\s*(\d{1,3})/gi,
    /--test-coverage-lines(?:=|\s+)(\d{1,3})/gi,
    /(?:coverageThreshold|thresholds)[\s\S]{0,800}?lines\s*[:=]\s*(\d{1,3})/gi,
  ];
  return patterns.some((pattern) => {
    for (const match of text.matchAll(pattern)) {
      if (Number.parseInt(match[1], 10) >= 80) return true;
    }
    return false;
  });
}

function successfulStep(jobs: GitHubWorkflowJobs['jobs'], pattern: RegExp) {
  return jobs.some((job) =>
    (pattern.test(job.name) && job.conclusion === 'success') ||
    (job.steps ?? []).some((step) => pattern.test(step.name) && step.conclusion === 'success'),
  );
}

async function getCiEvidence(base: string, branch: string, headers: HeadersInit, workflows: TextFile[]) {
  const empty: CiEvidence = {
    pipelinePassed: false,
    lintPassed: false,
    testsPassed: false,
    buildPassed: false,
    detail: 'Nenhum pipeline de qualidade concluído encontrado na branch padrão',
  };
  if (!workflows.length) return { evidence: empty, remaining: [] as number[] };

  const qualityPaths = new Set(workflows.filter(({ content }) => [
    /\b(lint|eslint|ruff|flake8|pylint)\b/i.test(content),
    /\b(test|pytest|vitest|jest|playwright|cypress)\b/i.test(content),
    /\b(build|compile|package|wheel)\b/i.test(content),
  ].filter(Boolean).length >= 2).map(({ path }) => path));

  try {
    const runs = await githubFetchFresh<GitHubWorkflowRuns>(
      `${base}/actions/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=20`, headers,
    );
    const run = runs.data.workflow_runs.find((item) => qualityPaths.has(item.path));
    if (!run) return { evidence: empty, remaining: runs.remaining === null ? [] : [runs.remaining] };
    const jobs = await githubFetchFresh<GitHubWorkflowJobs>(`${base}/actions/runs/${run.id}/jobs?per_page=100`, headers);
    return {
      evidence: {
        pipelinePassed: run.conclusion === 'success',
        lintPassed: successfulStep(jobs.data.jobs, /\b(lint|eslint|ruff|flake8|pylint|golangci|clippy)\b/i),
        testsPassed: successfulStep(jobs.data.jobs, /\b(test|tests|pytest|vitest|jest|playwright|cypress)\b/i),
        buildPassed: successfulStep(jobs.data.jobs, /\b(build|compile|package|wheel)\b/i),
        detail: `${run.name} · ${run.conclusion ?? run.status}`,
      },
      remaining: [runs.remaining, jobs.remaining].filter((value): value is number => value !== null),
    };
  } catch {
    return { evidence: empty, remaining: [] as number[] };
  }
}

export async function analyzeQualitySignals(args: {
  owner: string;
  repo: string;
  defaultBranch: string;
  tree: TreeEntry[];
  dependencies: DependencyItem[];
  repositoryLicense: { spdx_id?: string | null; name?: string | null } | null;
}): Promise<{ signals: QualitySignal[]; remaining: number[] }> {
  const { owner, repo, defaultBranch, tree, dependencies, repositoryLicense } = args;
  const headers = buildHeaders();
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const paths = tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path);
  const lowerPaths = paths.map((path) => path.toLowerCase());
  const deps = new Set(dependencies.map((item) => item.name.toLowerCase()));

  const candidatePaths = paths.filter((path) =>
    /(^|\/)(package\.json|\.gitignore|dockerfile|pyproject\.toml|pytest\.ini|setup\.cfg|tox\.ini|\.coveragerc|ruff\.toml|\.ruff\.toml|pyrightconfig\.json|mypy\.ini|tsconfig(?:\.[^/]+)?\.json|eslint\.config\.[^/]+|\.eslintrc(?:\.[^/]+)?|prettier\.config\.[^/]+|\.prettierrc(?:\.[^/]+)?|biome\.json|knip\.json|knip\.config\.[^/]+|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|gradle\.properties|[^/]+\.csproj|directory\.build\.props|go\.mod|\.golangci\.ya?ml|cargo\.toml|rustfmt\.toml|composer\.json|phpstan(?:\.neon)?|psalm\.xml|gemfile|\.rubocop\.ya?ml|\.swiftlint\.ya?ml|analysis_options\.ya?ml|pubspec\.ya?ml|cmakelists\.txt|\.clang-tidy|\.clang-format|renovate\.json)$/i.test(path) ||
    /^\.github\/workflows\/.*\.ya?ml$/i.test(path),
  ).slice(0, 60);
  const reads = await Promise.all(candidatePaths.map((path) => fetchTextFile(base, path, defaultBranch, headers)));
  const files = reads.flatMap(({ file }) => file ? [file] : []);
  const textByPath = new Map(files.map((file) => [file.path.toLowerCase(), file.content]));
  const combinedText = files.map((file) => file.content).join('\n');

  for (const file of files.filter((item) => /(^|\/)package\.json$/i.test(item.path))) {
    try {
      const manifest = JSON.parse(file.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const name of Object.keys(manifest.dependencies ?? {})) deps.add(name.toLowerCase());
      for (const name of Object.keys(manifest.devDependencies ?? {})) deps.add(name.toLowerCase());
    } catch {
      // Manifesto inválido: os demais sinais continuam sendo avaliados.
    }
  }
  const workflows = files.filter((file) => /^\.github\/workflows\/.*\.ya?ml$/i.test(file.path));
  const ci = await getCiEvidence(base, defaultBranch, headers, workflows);

  const hasNode = lowerPaths.some((path) => /(^|\/)package\.json$/.test(path));
  const hasPython = lowerPaths.some((path) => /(^|\/)(pyproject\.toml|requirements[^/]*\.txt|setup\.py)$/.test(path));
  const sensitive = paths.filter(isSensitivePath);
  const lockfile = paths.find((path) => LOCKFILES.has(basename(path)));
  const detectedDockerfiles = files.filter((file) => /(^|\/)dockerfile$/i.test(file.path));
  const qualityDockerfiles = detectedDockerfiles.filter(
    (file) => file.path.toLowerCase() === 'quality/dockerfile',
  );
  const dockerfiles = qualityDockerfiles.length
    ? qualityDockerfiles
    : detectedDockerfiles;
  const testsExist = lowerPaths.some((path) => /(^|\/)(__tests__|tests?|specs?)(\/|\.|$)/.test(path)) ||
    ['jest', 'vitest', '@playwright/test', 'cypress'].some((dep) => deps.has(dep));
  const lintConfigured = ['eslint', 'stylelint', 'biome', '@biomejs/biome'].some((dep) => deps.has(dep)) ||
    lowerPaths.some((path) => /(^|\/)(eslint\.config\.|\.eslintrc|ruff\.toml|\.ruff\.toml|pylintrc|\.flake8|\.golangci\.ya?ml|\.rubocop\.ya?ml|\.swiftlint\.ya?ml|analysis_options\.ya?ml|\.clang-tidy)/.test(path)) ||
    /\b(eslint|ruff|flake8|pylint|golangci-lint|staticcheck|clippy|checkstyle|spotbugs|detekt|ktlint|phpstan|psalm|rubocop|swiftlint|dart\s+analyze|clang-tidy|cppcheck)\b/i.test(combinedText);
  const typeChecking = deps.has('typescript') || lowerPaths.some((path) => /(^|\/)(tsconfig(?:\.[^/]+)?\.json|pyrightconfig\.json|mypy\.ini|phpstan(?:\.neon)?|psalm\.xml)$/.test(path)) ||
    /\b(tsc\s+(?:--noemit|-b)|mypy|pyright|flow\s+check|phpstan|psalm|srb\s+tc|sorbet)\b/i.test(combinedText);

  const hasCodeowners = lowerPaths.some((path) => /(^|\/)(\.github\/)?codeowners$/.test(path));
  const hasSecurityPolicy = lowerPaths.some((path) => /(^|\/)security\.md$/.test(path));
  const hasDependencyUpdates = lowerPaths.some((path) =>
    /^\.github\/dependabot\.ya?ml$/.test(path) ||
    /(^|\/)renovate(?:\.json|\.json5|\.ya?ml)$/.test(path),
  );
  const hasSast = /\b(codeql|semgrep|sonar-scanner|sonarqube|snyk\s+code)\b/i.test(combinedText);
  const hasSecretScanning = /\b(gitleaks|trufflehog|detect-secrets|gitguardian)\b/i.test(combinedText);
  const hasDependencyAudit = /\b(npm\s+audit|pnpm\s+audit|yarn\s+audit|pip-audit|safety\s+check|cargo\s+audit|govulncheck|composer\s+audit|bundle\s+audit|osv-scanner|dependency-check|dotnet\s+list[^\n]*vulnerable)\b/i.test(combinedText);
  const hasContributing = lowerPaths.some((path) => /(^|\/)contributing(?:\.[^/]+)?\.md$|(^|\/)contributing\.md$/.test(path));
  const hasChangelog = lowerPaths.some((path) => /(^|\/)(changelog|changes|history)(?:\.[^/]+)?\.md$/.test(path));
  const hasPrTemplate = lowerPaths.some((path) =>
    /(^|\/)pull_request_template\.md$/.test(path) ||
    /^\.github\/pull_request_template\//.test(path),
  );
  const hasIssueTemplates = lowerPaths.some((path) => /^\.github\/issue_template\//.test(path));
  const hasReleaseAutomation =
    /\b(release-please|semantic-release|changesets|goreleaser|cargo-release)\b/i.test(combinedText) ||
    lowerPaths.some((path) => /^\.github\/workflows\/(release|publish)[^/]*\.ya?ml$/.test(path));
  const hasIntegrationTests =
    lowerPaths.some((path) => /(^|\/)(integration|integration-tests?|tests?\/integration)(\/|\.|$)/.test(path)) ||
    /\b(test:integration|integration[- ]tests?)\b/i.test(combinedText);
  const hasE2eTests =
    lowerPaths.some((path) => /(^|\/)(e2e|end-to-end)(\/|\.|$)/.test(path)) ||
    ['@playwright/test', 'cypress'].some((dep) => deps.has(dep)) ||
    /\b(playwright|cypress|test:e2e)\b/i.test(combinedText);

  const hasTypeScriptStrict = files
    .filter((file) => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(file.path))
    .some((file) => /"strict"\s*:\s*true/i.test(file.content));
  const hasNodeEngine = files
    .filter((file) => /(^|\/)package\.json$/i.test(file.path))
    .some((file) => /"engines"\s*:\s*\{[\s\S]{0,400}?"node"\s*:/i.test(file.content));
  const hasPythonTyping =
    lowerPaths.some((path) => /(^|\/)(pyrightconfig\.json|mypy\.ini)$/.test(path)) ||
    /\b(mypy|pyright)\b|\[tool\.(mypy|pyright)\]/i.test(combinedText);
  const hasJvmQuality = /\b(checkstyle|spotbugs|detekt|ktlint|pmd)\b/i.test(combinedText);
  const hasDotnetAnalyzers =
    /<Nullable>\s*(enable|warnings|annotations)\s*<\/Nullable>/i.test(combinedText) ||
    /<EnableNETAnalyzers>\s*true\s*<\/EnableNETAnalyzers>/i.test(combinedText) ||
    /\b(StyleCop\.Analyzers|SonarAnalyzer\.CSharp|Microsoft\.CodeAnalysis\.NetAnalyzers)\b/i.test(combinedText);
  const hasGoStaticAnalysis = /\b(golangci-lint|staticcheck|go\s+vet)\b/i.test(combinedText) ||
    lowerPaths.some((path) => /(^|\/)\.golangci\.ya?ml$/.test(path));
  const hasRustQuality = /\bclippy\b/i.test(combinedText) &&
    (/\brustfmt\b/i.test(combinedText) || lowerPaths.some((path) => /(^|\/)rustfmt\.toml$/.test(path)));
  const hasPhpStaticAnalysis = /\b(phpstan|psalm)\b/i.test(combinedText) ||
    lowerPaths.some((path) => /(^|\/)(phpstan(?:\.neon)?|psalm\.xml)$/.test(path));
  const hasRubyLint = /\brubocop\b/i.test(combinedText) ||
    lowerPaths.some((path) => /(^|\/)\.rubocop\.ya?ml$/.test(path));
  const hasSwiftLint = /\bswiftlint\b/i.test(combinedText) ||
    lowerPaths.some((path) => /(^|\/)\.swiftlint\.ya?ml$/.test(path));
  const hasDartAnalysis = /\bdart\s+analyze\b/i.test(combinedText) ||
    lowerPaths.some((path) => /(^|\/)analysis_options\.ya?ml$/.test(path));
  const hasNativeStaticAnalysis = /\b(clang-tidy|cppcheck)\b/i.test(combinedText) ||
    lowerPaths.some((path) => /(^|\/)\.clang-tidy$/.test(path));

  const signals: QualitySignal[] = [
    { label: 'Sem arquivos sensíveis', found: sensitive.length === 0, detail: sensitive.length ? `Arquivos potencialmente sensíveis: ${sensitive.slice(0, 3).join(', ')}` : 'Nenhum nome de arquivo sensível detectado' },
    { label: '.gitignore adequado', found: gitignoreIsAdequate(textByPath.get('.gitignore') ?? null, hasNode, hasPython), detail: 'Ignora segredos, dependências e artefatos gerados' },
    { label: 'README', found: lowerPaths.some((path) => /(^|\/)readme(?:\.|$)/.test(path)), detail: 'README presente' },
    { label: '.env.example', found: lowerPaths.some((path) => /(^|\/)\.env\.example$/.test(path)), detail: 'Exemplo de variáveis de ambiente presente' },
    { label: 'Arquitetura', found: lowerPaths.some((path) => /(^|\/)(architecture|arquitetura)(?:\.[^/]+)?\.md$/.test(path) || /(^|\/)docs\/adr\//.test(path)), detail: 'Documentação de arquitetura ou ADR detectada' },
    { label: 'LICENSE', found: Boolean(repositoryLicense) || lowerPaths.some((path) => /(^|\/)(license|licence)(\.|$)/.test(path)), detail: repositoryLicense?.spdx_id ?? repositoryLicense?.name ?? 'Arquivo LICENSE detectado' },
    { label: 'Docker seguro', found: dockerIsSafe(dockerfiles), detail: qualityDockerfiles.length ? 'Container de qualidade versionado, não-root e sem segredos hardcoded' : 'Imagem versionada, usuário não-root e sem segredo hardcoded em ENV/ARG' },
    { label: 'Dockerfile', found: lowerPaths.some((path) => /(^|\/)dockerfile$/.test(path)), detail: 'Dockerfile detectado' },
    { label: 'Pipeline completo verde', found: ci.evidence.pipelinePassed, detail: ci.evidence.detail },
    { label: 'GitHub Actions', found: workflows.length > 0, detail: 'Workflow do GitHub Actions detectado' },
    { label: 'Lockfile', found: Boolean(lockfile), detail: lockfile ? `Lockfile: ${lockfile}` : 'Nenhum lockfile conhecido detectado' },
    { label: 'Testes existentes', found: testsExist, detail: 'Arquivos ou framework de testes detectados' },
    { label: 'Lint realmente passa', found: ci.evidence.lintPassed, detail: ci.evidence.lintPassed ? `Lint aprovado no CI · ${ci.evidence.detail}` : 'Lint aprovado não confirmado no último CI' },
    { label: 'Lint configurado', found: lintConfigured, detail: 'Ferramenta ou configuração de lint detectada' },
    { label: 'Type checking', found: typeChecking, detail: 'TypeScript/tsconfig ou verificador estático de tipos detectado' },
    { label: 'Formatter', found: hasFormatter(deps, lowerPaths, combinedText), detail: 'Formatter ou configuração equivalente detectada' },
    { label: 'Código morto', found: hasDeadCodeCheck(deps, lowerPaths, combinedText), detail: 'Verificação de código ou exports não utilizados detectada' },
    { label: 'Cobertura ≥ 80%', found: hasCoverage80(combinedText), detail: 'Limiar explícito de cobertura de pelo menos 80% detectado' },
    { label: 'Testes passam', found: ci.evidence.testsPassed, detail: ci.evidence.testsPassed ? `Testes aprovados no CI · ${ci.evidence.detail}` : 'Testes aprovados não confirmados no último CI' },
    { label: 'Build passa', found: ci.evidence.buildPassed, detail: ci.evidence.buildPassed ? `Build aprovado no CI · ${ci.evidence.detail}` : 'Build aprovado não confirmado no último CI' },

    { label: 'CODEOWNERS', found: hasCodeowners, detail: hasCodeowners ? 'CODEOWNERS detectado' : 'Nenhum CODEOWNERS detectado' },
    { label: 'SECURITY.md', found: hasSecurityPolicy, detail: hasSecurityPolicy ? 'Política de segurança detectada' : 'SECURITY.md não encontrado' },
    { label: 'Atualização automática de dependências', found: hasDependencyUpdates, detail: hasDependencyUpdates ? 'Dependabot ou Renovate detectado' : 'Automação de atualização de dependências não detectada' },
    { label: 'SAST no CI', found: hasSast, detail: hasSast ? 'Ferramenta de SAST detectada no fluxo automatizado' : 'SAST não detectado no CI' },
    { label: 'Varredura de segredos no CI', found: hasSecretScanning, detail: hasSecretScanning ? 'Varredura automatizada de segredos detectada' : 'Varredura de segredos não detectada' },
    { label: 'Auditoria de dependências', found: hasDependencyAudit, detail: hasDependencyAudit ? 'Auditoria automatizada de dependências detectada' : 'Auditoria de vulnerabilidades não detectada' },
    { label: 'CONTRIBUTING', found: hasContributing, detail: hasContributing ? 'Guia de contribuição detectado' : 'CONTRIBUTING não encontrado' },
    { label: 'CHANGELOG', found: hasChangelog, detail: hasChangelog ? 'Histórico de mudanças detectado' : 'CHANGELOG não encontrado' },
    { label: 'Template de Pull Request', found: hasPrTemplate, detail: hasPrTemplate ? 'Template de Pull Request detectado' : 'Template de Pull Request não encontrado' },
    { label: 'Templates de Issue', found: hasIssueTemplates, detail: hasIssueTemplates ? 'Templates de Issue detectados' : 'Templates de Issue não encontrados' },
    { label: 'Automação de release', found: hasReleaseAutomation, detail: hasReleaseAutomation ? 'Automação de release detectada' : 'Automação de release não detectada' },
    { label: 'Testes de integração', found: hasIntegrationTests, detail: hasIntegrationTests ? 'Suite de integração detectada' : 'Testes de integração não detectados' },
    { label: 'Testes E2E', found: hasE2eTests, detail: hasE2eTests ? 'Suite E2E detectada' : 'Testes E2E não detectados' },

    { label: 'TypeScript strict', found: hasTypeScriptStrict, detail: hasTypeScriptStrict ? 'tsconfig com strict=true' : 'Modo strict não detectado' },
    { label: 'Node.js engine declarado', found: hasNodeEngine, detail: hasNodeEngine ? 'Versão do Node.js declarada em package.json' : 'Campo engines.node não detectado' },
    { label: 'Tipagem Python', found: hasPythonTyping, detail: hasPythonTyping ? 'mypy ou Pyright detectado' : 'Ferramenta de tipagem Python não detectada' },
    { label: 'Qualidade JVM', found: hasJvmQuality, detail: hasJvmQuality ? 'Ferramenta de qualidade JVM detectada' : 'Checkstyle/SpotBugs/Detekt/ktlint não detectado' },
    { label: 'Nullable + analyzers .NET', found: hasDotnetAnalyzers, detail: hasDotnetAnalyzers ? 'Nullable/analyzers .NET detectados' : 'Nullable/analyzers .NET não detectados' },
    { label: 'Análise estática Go', found: hasGoStaticAnalysis, detail: hasGoStaticAnalysis ? 'golangci-lint, staticcheck ou go vet detectado' : 'Análise estática Go não detectada' },
    { label: 'Clippy + rustfmt', found: hasRustQuality, detail: hasRustQuality ? 'Clippy e rustfmt detectados' : 'Clippy e rustfmt não detectados em conjunto' },
    { label: 'PHPStan / Psalm', found: hasPhpStaticAnalysis, detail: hasPhpStaticAnalysis ? 'PHPStan ou Psalm detectado' : 'Análise estática PHP não detectada' },
    { label: 'RuboCop', found: hasRubyLint, detail: hasRubyLint ? 'RuboCop detectado' : 'RuboCop não detectado' },
    { label: 'SwiftLint', found: hasSwiftLint, detail: hasSwiftLint ? 'SwiftLint detectado' : 'SwiftLint não detectado' },
    { label: 'Dart analyzer', found: hasDartAnalysis, detail: hasDartAnalysis ? 'Dart analyzer configurado' : 'analysis_options.yaml/dart analyze não detectado' },
    { label: 'Análise estática C/C++', found: hasNativeStaticAnalysis, detail: hasNativeStaticAnalysis ? 'clang-tidy ou cppcheck detectado' : 'Análise estática C/C++ não detectada' },
  ];

  return {
    signals,
    remaining: [...reads.map((result) => result.remaining), ...ci.remaining].filter((value): value is number => value !== null),
  };
}
