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
  'cargo.lock', 'go.sum', 'composer.lock', 'gemfile.lock',
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
  return ['prettier', '@biomejs/biome', 'dprint', 'black', 'yapf', 'autopep8', 'isort', 'ruff'].some((dep) => deps.has(dep)) ||
    paths.some((path) => /(^|\/)(\.prettierrc|prettier\.config\.|biome\.json|dprint\.json)/i.test(path)) ||
    /\b(prettier|biome\s+format|dprint|black|ruff\s+format|gofmt|rustfmt|spotless)\b|\[tool\.ruff\.format\]/i.test(text);
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
    /(^|\/)(package\.json|\.gitignore|dockerfile|pyproject\.toml|pytest\.ini|setup\.cfg|tox\.ini|\.coveragerc|ruff\.toml|\.ruff\.toml|tsconfig(?:\.[^/]+)?\.json|eslint\.config\.[^/]+|\.eslintrc(?:\.[^/]+)?|prettier\.config\.[^/]+|\.prettierrc(?:\.[^/]+)?|biome\.json|knip\.json|knip\.config\.[^/]+)$/i.test(path) ||
    /^\.github\/workflows\/.*\.ya?ml$/i.test(path),
  ).slice(0, 30);
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
    lowerPaths.some((path) => /(^|\/)(eslint\.config\.|\.eslintrc|ruff\.toml|\.ruff\.toml|pylintrc|\.flake8)/.test(path)) ||
    /\b(eslint|ruff|flake8|pylint|golangci-lint|clippy)\b/i.test(combinedText);
  const typeChecking = deps.has('typescript') || lowerPaths.some((path) => /(^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(path)) ||
    /\b(tsc\s+(?:--noemit|-b)|mypy|pyright|flow\s+check)\b/i.test(combinedText);

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
  ];

  return {
    signals,
    remaining: [...reads.map((result) => result.remaining), ...ci.remaining].filter((value): value is number => value !== null),
  };
}
