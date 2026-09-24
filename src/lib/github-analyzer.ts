import type {
  ArchitectureLayer,
  DependencyItem,
  LanguageStat,
  QualitySignal,
  RepositoryAnalysis,
  StackItem,
  TreeEntry,
} from '@/types/repository';

interface GitHubRepository {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  updated_at: string;
  owner: { login: string };
  license: { spdx_id?: string | null; name?: string | null } | null;
}

interface GitHubTree {
  truncated: boolean;
  tree: Array<{
    path: string;
    type: 'blob' | 'tree' | 'commit';
    size?: number;
  }>;
}

interface GitHubContent {
  content?: string;
  encoding?: string;
}

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const STACK_RULES: Array<{
  name: string;
  category: StackItem['category'];
  dependencies?: string[];
  files?: RegExp[];
}> = [
  { name: 'Next.js', category: 'Frontend', dependencies: ['next'] },
  { name: 'React', category: 'Frontend', dependencies: ['react'] },
  { name: 'Vue', category: 'Frontend', dependencies: ['vue'] },
  { name: 'Svelte', category: 'Frontend', dependencies: ['svelte', '@sveltejs/kit'] },
  { name: 'Angular', category: 'Frontend', dependencies: ['@angular/core'] },
  { name: 'Tailwind CSS', category: 'Frontend', dependencies: ['tailwindcss'] },
  { name: 'Redux Toolkit', category: 'Frontend', dependencies: ['@reduxjs/toolkit'] },
  { name: 'React Router', category: 'Frontend', dependencies: ['react-router', 'react-router-dom'] },
  { name: 'NestJS', category: 'Backend', dependencies: ['@nestjs/core'] },
  { name: 'Express', category: 'Backend', dependencies: ['express'] },
  { name: 'Fastify', category: 'Backend', dependencies: ['fastify'] },
  { name: 'Prisma', category: 'Data', dependencies: ['prisma', '@prisma/client'], files: [/prisma\/schema\.prisma$/] },
  { name: 'Supabase', category: 'Data', dependencies: ['@supabase/supabase-js'], files: [/supabase/i] },
  { name: 'PostgreSQL', category: 'Data', dependencies: ['pg'] },
  { name: 'MongoDB', category: 'Data', dependencies: ['mongodb', 'mongoose'] },
  { name: 'Redis', category: 'Data', dependencies: ['redis', 'ioredis'] },
  { name: 'Vitest', category: 'Testing', dependencies: ['vitest'] },
  { name: 'Jest', category: 'Testing', dependencies: ['jest'] },
  { name: 'Playwright', category: 'Testing', dependencies: ['@playwright/test'] },
  { name: 'Cypress', category: 'Testing', dependencies: ['cypress'] },
  { name: 'TypeScript', category: 'Tooling', dependencies: ['typescript'], files: [/tsconfig\.json$/] },
  { name: 'ESLint', category: 'Tooling', dependencies: ['eslint'], files: [/eslint\.config\./] },
  { name: 'Prettier', category: 'Tooling', dependencies: ['prettier'], files: [/\.prettierrc/, /prettier\.config\./] },
  { name: 'Docker', category: 'DevOps', files: [/(^|\/)Dockerfile$/i, /docker-compose/i] },
  { name: 'GitHub Actions', category: 'DevOps', files: [/^\.github\/workflows\//] },
  { name: 'Vercel', category: 'DevOps', files: [/vercel\.json$/] },
];

function parseRepoInput(input: string) {
  const normalized = input.trim().replace(/\/$/, '');
  const urlMatch = normalized.match(
    /^(?:https?:\/\/)?github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/i,
  );
  const shortMatch = normalized.match(/^([^/\s]+)\/([^/\s]+)$/);

  const owner = urlMatch?.[1] ?? shortMatch?.[1];
  const repo = urlMatch?.[2] ?? shortMatch?.[2];

  if (!owner || !repo || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('Informe uma URL do GitHub ou owner/repository válido.');
  }

  return { owner, repo };
}

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

async function githubFetch<T>(url: string, headers: HeadersInit): Promise<{ data: T; remaining: number | null }> {
  const response = await fetch(url, {
    headers,
    next: { revalidate: 600 },
  });

  if (response.status === 404) {
    throw new Error('Repositório público não encontrado.');
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Limite da API do GitHub atingido. Tente novamente mais tarde ou configure GITHUB_TOKEN.');
    }
    throw new Error(`GitHub respondeu com HTTP ${response.status}.`);
  }

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

function collectDependencies(
  manifests: Array<{ path: string; data: PackageManifest }>,
): DependencyItem[] {
  return manifests
    .flatMap(({ path, data }) => [
      ...Object.entries(data.dependencies ?? {}).map(([name, version]) => ({
        name,
        version,
        scope: 'runtime' as const,
        manifest: path,
      })),
      ...Object.entries(data.devDependencies ?? {}).map(([name, version]) => ({
        name,
        version,
        scope: 'development' as const,
        manifest: path,
      })),
    ])
    .sort((a, b) => a.name.localeCompare(b.name));
}

function detectStack(
  dependencies: DependencyItem[],
  tree: TreeEntry[],
): StackItem[] {
  const dependencyNames = new Set(dependencies.map((item) => item.name));
  const paths = tree.map((entry) => entry.path);

  return STACK_RULES.flatMap((rule) => {
    const matchedDependency = rule.dependencies?.find((dependency) =>
      dependencyNames.has(dependency),
    );
    const matchedFile = rule.files
      ?.flatMap((pattern) => paths.filter((path) => pattern.test(path)))
      .at(0);

    const evidence = matchedDependency
      ? `dependência ${matchedDependency}`
      : matchedFile
        ? `arquivo ${matchedFile}`
        : null;

    return evidence
      ? [{ name: rule.name, category: rule.category, evidence }]
      : [];
  });
}

function buildLayers(stack: StackItem[], tree: TreeEntry[]): ArchitectureLayer[] {
  const namesByCategory = (category: StackItem['category']) =>
    stack.filter((item) => item.category === category).map((item) => item.name);

  const layers: ArchitectureLayer[] = [];
  const frontend = namesByCategory('Frontend');
  const backend = namesByCategory('Backend');
  const data = namesByCategory('Data');
  const delivery = namesByCategory('DevOps');

  if (frontend.length) {
    layers.push({
      name: 'Presentation',
      role: 'Interface, navegação e experiência do usuário',
      technologies: frontend,
    });
  }

  const hasApiFolders = tree.some((entry) =>
    /(^|\/)(api|server|backend)(\/|$)/i.test(entry.path),
  );
  if (backend.length || hasApiFolders) {
    layers.push({
      name: 'Application / API',
      role: 'Endpoints, regras de aplicação e integração',
      technologies: backend.length ? backend : ['API routes detectadas'],
    });
  }

  if (data.length) {
    layers.push({
      name: 'Data',
      role: 'Persistência, ORM e serviços de dados',
      technologies: data,
    });
  }

  if (delivery.length) {
    layers.push({
      name: 'Delivery',
      role: 'Build, CI/CD, containers e hospedagem',
      technologies: delivery,
    });
  }

  if (!layers.length) {
    layers.push({
      name: 'Repository',
      role: 'Estrutura detectada sem framework arquitetural explícito',
      technologies: ['Código-fonte'],
    });
  }

  return layers;
}

function qualitySignals(
  tree: TreeEntry[],
  dependencies: DependencyItem[],
  repository: GitHubRepository,
): QualitySignal[] {
  const paths = tree.map((entry) => entry.path.toLowerCase());
  const deps = new Set(dependencies.map((item) => item.name));

  const has = (matcher: (path: string) => boolean) => paths.some(matcher);

  return [
    {
      label: 'Documentação',
      found: has((path) => /^readme(\.|$)/.test(path)),
      detail: 'README no repositório',
    },
    {
      label: 'CI/CD',
      found: has((path) => path.startsWith('.github/workflows/')),
      detail: 'GitHub Actions configurado',
    },
    {
      label: 'TypeScript',
      found: has((path) => path.endsWith('tsconfig.json')) || deps.has('typescript'),
      detail: 'Configuração ou dependência TypeScript',
    },
    {
      label: 'Testes automatizados',
      found:
        has((path) => /(^|\/)(__tests__|tests?|spec)(\/|\.|$)/.test(path)) ||
        ['jest', 'vitest', '@playwright/test', 'cypress'].some((dep) => deps.has(dep)),
      detail: 'Arquivos ou framework de testes detectados',
    },
    {
      label: 'Lint',
      found: deps.has('eslint') || has((path) => path.includes('eslint.config')),
      detail: 'ESLint detectado',
    },
    {
      label: 'Container',
      found: has((path) => path.endsWith('dockerfile') || path.includes('docker-compose')),
      detail: 'Docker detectado',
    },
    {
      label: 'Exemplo de ambiente',
      found: has((path) => path.endsWith('.env.example')),
      detail: '.env.example presente',
    },
    {
      label: 'Licença',
      found: Boolean(repository.license),
      detail: repository.license?.spdx_id ?? repository.license?.name ?? 'Licença não detectada',
    },
  ];
}

export async function analyzeRepository(input: string): Promise<RepositoryAnalysis> {
  const { owner, repo } = parseRepoInput(input);
  const headers = buildHeaders();
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const repositoryResult = await githubFetch<GitHubRepository>(base, headers);
  const repository = repositoryResult.data;

  const [languagesResult, treeResult] = await Promise.all([
    githubFetch<Record<string, number>>(`${base}/languages`, headers),
    githubFetch<GitHubTree>(
      `${base}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`,
      headers,
    ),
  ]);

  const allTree: TreeEntry[] = treeResult.data.tree
    .filter((entry) => entry.type === 'blob' || entry.type === 'tree')
    .map((entry) => ({
      path: entry.path,
      type: entry.type as 'blob' | 'tree',
      size: typeof entry.size === 'number' ? entry.size : null,
    }));

  const manifestPaths = allTree
    .filter(
      (entry) =>
        entry.type === 'blob' &&
        /(^|\/)package\.json$/.test(entry.path) &&
        entry.path.split('/').length <= 4,
    )
    .slice(0, 6)
    .map((entry) => entry.path);

  const manifests = (
    await Promise.all(
      manifestPaths.map(async (path) => {
        try {
          const result = await githubFetch<GitHubContent>(
            `${base}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(repository.default_branch)}`,
            headers,
          );
          const decoded = decodeContent(result.data);
          if (!decoded) return null;
          return {
            path,
            data: JSON.parse(decoded) as PackageManifest,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter((item): item is { path: string; data: PackageManifest } => item !== null);

  const dependencies = collectDependencies(manifests);
  const stack = detectStack(dependencies, allTree);
  const layers = buildLayers(stack, allTree);
  const signals = qualitySignals(allTree, dependencies, repository);

  const totalLanguageBytes = Object.values(languagesResult.data).reduce(
    (total, value) => total + value,
    0,
  );
  const languages: LanguageStat[] = Object.entries(languagesResult.data)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalLanguageBytes > 0 ? (bytes / totalLanguageBytes) * 100 : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const visibleTree = allTree
    .filter((entry) => entry.path.split('/').length <= 4)
    .slice(0, 700);

  const remainingCandidates = [
    repositoryResult.remaining,
    languagesResult.remaining,
    treeResult.remaining,
  ].filter((value): value is number => value !== null);

  return {
    repository: {
      fullName: repository.full_name,
      name: repository.name,
      owner: repository.owner.login,
      description: repository.description,
      htmlUrl: repository.html_url,
      homepage: repository.homepage,
      defaultBranch: repository.default_branch,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      openIssues: repository.open_issues_count,
      sizeKb: repository.size,
      license: repository.license?.spdx_id ?? repository.license?.name ?? null,
      updatedAt: repository.updated_at,
    },
    languages,
    stack,
    layers,
    qualitySignals: signals,
    dependencies,
    tree: visibleTree,
    totals: {
      files: allTree.filter((entry) => entry.type === 'blob').length,
      directories: allTree.filter((entry) => entry.type === 'tree').length,
      manifests: manifests.length,
    },
    treeTruncated: treeResult.data.truncated || visibleTree.length < allTree.length,
    rateLimitRemaining: remainingCandidates.length
      ? Math.min(...remainingCandidates)
      : null,
    analyzedAt: new Date().toISOString(),
  };
}
