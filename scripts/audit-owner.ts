import { writeFile } from 'node:fs/promises';
import { analyzeQualitySignals } from '../src/lib/quality-analyzer.ts';
import {
  automaticQualityProfile,
  calculateQualityScore,
  qualityCriterionLabels,
} from '../src/lib/quality-criteria.ts';

type Repo = {
  name: string;
  full_name: string;
  default_branch: string;
  archived: boolean;
  fork: boolean;
  license: { spdx_id?: string | null; name?: string | null } | null;
};

type TreeEntry = {
  path: string;
  type: 'blob' | 'tree';
  size: number | null;
};

type DependencyItem = {
  name: string;
  version: string;
  scope: 'runtime' | 'development';
  manifest: string;
};

type StackItem = {
  name: string;
  category: 'Frontend' | 'Backend' | 'Data' | 'Testing' | 'DevOps' | 'Tooling';
  evidence: string;
};

const owner = process.env.OWNER || 'leoo1992';
const batchRepositories = new Set([
  'Leo-AI-poc',
  'login-react',
  'poc-dasboard-fintech',
  'POC-Redux-App-Viagem',
  'POC-Redux-Filtros',
  'POC-Redux-Login',
  'portfolio-leonardo-react',
  'project_mananger_poc',
  'ReactNativeTraining',
  'sistema_ponto',
]);
const token = process.env.GITHUB_TOKEN?.trim();
const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'reposcope-owner-audit',
};
if (token) headers.Authorization = `Bearer ${token}`;

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} · ${url}`);
  }
  return await response.json() as T;
}

async function raw(repo: string, branch: string, path: string) {
  const url =
    `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/` +
    `${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetch(url);
  return response.ok ? await response.text() : null;
}

async function listRepos() {
  const repos: Repo[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await api<Repo[]>(
      `https://api.github.com/users/${encodeURIComponent(owner)}/repos?type=owner&sort=full_name&direction=asc&per_page=100&page=${page}`,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter((repo) => !repo.archived && !repo.fork);
}

function collectDependencies(
  manifests: Array<{ path: string; content: string }>,
): DependencyItem[] {
  return manifests.flatMap(({ path, content }) => {
    try {
      const data = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return [
        ...Object.entries(data.dependencies ?? {}).map(([name, version]) => ({
          name, version, scope: 'runtime' as const, manifest: path,
        })),
        ...Object.entries(data.devDependencies ?? {}).map(([name, version]) => ({
          name, version, scope: 'development' as const, manifest: path,
        })),
      ];
    } catch {
      return [];
    }
  });
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

function detectStack(dependencies: DependencyItem[], tree: TreeEntry[]) {
  const dependencyNames = new Set(dependencies.map((item) => item.name));
  const paths = tree.map((entry) => entry.path);

  return STACK_RULES.flatMap((rule) => {
    const dep = rule.dependencies?.find((name) => dependencyNames.has(name));
    const file = rule.files?.flatMap((pattern) => paths.filter((path) => pattern.test(path))).at(0);
    if (!dep && !file) return [];
    return [{
      name: rule.name,
      category: rule.category,
      evidence: dep ? `dependência ${dep}` : `arquivo ${file}`,
    }];
  });
}

function detectEcosystemStack(tree: TreeEntry[], manifests: Array<{ path: string; content: string }>) {
  const paths = tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path.toLowerCase());
  const combined = manifests.map((manifest) => manifest.content).join('\n');
  const detected: StackItem[] = [];

  const add = (name: string, category: StackItem['category'], evidence: string) => {
    if (!detected.some((item) => item.name === name)) detected.push({ name, category, evidence });
  };

  if (paths.some((path) => /(^|\/)manage\.py$/.test(path)) && /\bdjango\b/i.test(combined)) {
    add('Django', 'Backend', 'manage.py + dependência Django');
  }
  if (/\bfastapi\b/i.test(combined)) add('FastAPI', 'Backend', 'dependência FastAPI');
  if (/\b(spring-boot|org\.springframework\.boot|springframework\.boot)\b/i.test(combined)) {
    add('Spring Boot', 'Backend', 'manifesto Spring Boot');
  }
  if (paths.some((path) => /(^|\/)artisan$/.test(path)) || /"laravel\/framework"\s*:/i.test(combined)) {
    add('Laravel', 'Backend', 'estrutura ou dependência Laravel');
  }
  if (paths.some((path) => /(^|\/)config\/routes\.rb$/.test(path)) && /\brails\b/i.test(combined)) {
    add('Ruby on Rails', 'Backend', 'routes.rb + dependência Rails');
  }
  if (paths.some((path) => /\.csproj$/.test(path))) add('.NET', 'Backend', 'arquivo .csproj');
  if (paths.some((path) => /(^|\/)\.metadata$/.test(path)) || /sdk:\s*flutter|flutter:\s*[\r\n]/i.test(combined)) {
    add('Flutter', 'Frontend', 'manifesto Flutter');
  }
  if (paths.some((path) => /(^|\/)go\.mod$/.test(path))) add('Go', 'Backend', 'go.mod');
  if (paths.some((path) => /(^|\/)cargo\.toml$/.test(path))) add('Rust', 'Backend', 'Cargo.toml');

  return detected;
}

function isQualityInfrastructurePath(path: string) {
  const normalized = path.toLowerCase();
  return normalized.startsWith('quality/') ||
    normalized === 'tests/repository-quality.test.mjs' ||
    normalized === '.github/workflows/repository-quality.yml';
}

function detectProjectLanguages(tree: TreeEntry[]) {
  const detected = new Set<string>();
  for (const entry of tree) {
    if (entry.type !== 'blob') continue;
    const path = entry.path.toLowerCase();
    if (/\.(?:js|jsx|mjs|cjs|vue|svelte)$/.test(path)) detected.add('JavaScript');
    if (/\.(?:ts|tsx)$/.test(path)) detected.add('TypeScript');
    if (/\.py$/.test(path)) detected.add('Python');
    if (/\.java$/.test(path)) detected.add('Java');
    if (/\.cs$/.test(path)) detected.add('C#');
    if (/\.go$/.test(path)) detected.add('Go');
    if (/\.rs$/.test(path)) detected.add('Rust');
    if (/\.php$/.test(path)) detected.add('PHP');
    if (/\.rb$/.test(path)) detected.add('Ruby');
    if (/\.kts?$/.test(path)) detected.add('Kotlin');
    if (/\.swift$/.test(path)) detected.add('Swift');
    if (/\.dart$/.test(path)) detected.add('Dart');
    if (/\.(?:cpp|cc|cxx|hpp|hh|hxx)$/.test(path)) detected.add('C++');
    if (/\.(?:c|h)$/.test(path)) detected.add('C');
  }
  return [...detected];
}

function mergeStack(...groups: StackItem[][]) {
  const map = new Map<string, StackItem>();
  for (const item of groups.flat()) if (!map.has(item.name)) map.set(item.name, item);
  return [...map.values()];
}

async function analyze(repo: Repo) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
  const [languageBytes, treeData] = await Promise.all([
    api<Record<string, number>>(`${base}/languages`),
    api<{ tree: Array<{ path: string; type: string; size?: number }>; truncated: boolean }>(
      `${base}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
    ),
  ]);

  const tree: TreeEntry[] = treeData.tree
    .filter((entry) => entry.type === 'blob' || entry.type === 'tree')
    .map((entry) => ({
      path: entry.path,
      type: entry.type as 'blob' | 'tree',
      size: typeof entry.size === 'number' ? entry.size : null,
    }));

  const projectTree = tree.filter((entry) => !isQualityInfrastructurePath(entry.path));

  const packagePaths = projectTree
    .filter((entry) => entry.type === 'blob' && /(^|\/)package\.json$/i.test(entry.path) && entry.path.split('/').length <= 4)
    .slice(0, 8)
    .map((entry) => entry.path);

  const ecosystemPaths = projectTree
    .filter((entry) =>
      entry.type === 'blob' &&
      /(^|\/)(pyproject\.toml|requirements[^/]*\.txt|pom\.xml|build\.gradle(?:\.kts)?|composer\.json|gemfile|pubspec\.ya?ml|[^/]+\.csproj|go\.mod|cargo\.toml)$/i.test(entry.path) &&
      entry.path.split('/').length <= 5,
    )
    .slice(0, 20)
    .map((entry) => entry.path);

  const packageManifests = (
    await Promise.all(packagePaths.map(async (path) => {
      const content = await raw(repo.name, repo.default_branch, path);
      return content === null ? null : { path, content };
    }))
  ).filter((item): item is { path: string; content: string } => item !== null);

  const ecosystemManifests = (
    await Promise.all(ecosystemPaths.map(async (path) => {
      const content = await raw(repo.name, repo.default_branch, path);
      return content === null ? null : { path, content };
    }))
  ).filter((item): item is { path: string; content: string } => item !== null);

  const dependencies = collectDependencies(packageManifests);
  const stack = mergeStack(
    detectStack(dependencies, projectTree),
    detectEcosystemStack(projectTree, ecosystemManifests),
  );

  const languages = detectProjectLanguages(projectTree);
  const profile = automaticQualityProfile(languages, stack.map((item) => item.name));
  const previousToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  const result = await analyzeQualitySignals({
    owner,
    repo: repo.name,
    defaultBranch: repo.default_branch,
    tree,
    dependencies,
    repositoryLicense: repo.license,
  });
  if (previousToken) process.env.GITHUB_TOKEN = previousToken;
  const quality = calculateQualityScore(result.signals, profile.ids, languages);
  const labels = qualityCriterionLabels(profile.ids, languages);
  const missing = result.signals
    .filter((signal) => labels.has(signal.label) && !signal.found)
    .map((signal) => signal.label);

  return {
    repository: repo.full_name,
    defaultBranch: repo.default_branch,
    languages,
    stack: stack.map((item) => item.name),
    profile: profile.label,
    score: quality.score,
    passed: quality.passed,
    total: quality.total,
    missing,
  };
}

const repos = (await listRepos()).filter((repo) => batchRepositories.has(repo.name));
const report: Array<Record<string, unknown>> = [];

for (const [index, repo] of repos.entries()) {
  try {
    const result = await analyze(repo);
    report.push(result);
    console.log(`[${index + 1}/${repos.length}] ${repo.full_name}: ${result.score}% · missing=${result.missing.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.push({ repository: repo.full_name, score: null, error: message });
    console.error(`[${index + 1}/${repos.length}] ${repo.full_name}: ERROR ${message}`);
  }
}

report.sort((a, b) => {
  const aScore = typeof a.score === 'number' ? a.score : -1;
  const bScore = typeof b.score === 'number' ? b.score : -1;
  return aScore - bScore || String(a.repository).localeCompare(String(b.repository));
});

const summary = {
  owner,
  generatedAt: new Date().toISOString(),
  repositories: report.length,
  perfect: report.filter((item) => item.score === 100).length,
  below100: report.filter((item) => typeof item.score === 'number' && item.score < 100).length,
  errors: report.filter((item) => item.score === null).length,
  results: report,
};

await writeFile('owner-quality-report.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  repositories: summary.repositories,
  perfect: summary.perfect,
  below100: summary.below100,
  errors: summary.errors,
}));
