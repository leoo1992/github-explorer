import { analyzeQualitySignals } from '@/lib/quality-analyzer';
import type { OwnerQualitySummary, TreeEntry } from '@/types/repository';

interface GitHubRepositoryListItem {
  name: string;
  full_name: string;
  default_branch: string;
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

async function githubJson<T>(url: string, headers: HeadersInit): Promise<T> {
  const response = await fetch(url, {
    headers,
    next: { revalidate: 3600 },
  });

  if (response.status === 404) {
    throw new Error('Usuário do GitHub não encontrado.');
  }

  if (response.status === 403) {
    throw new Error(
      'Limite da API do GitHub atingido. Configure GITHUB_TOKEN para calcular a média de todos os repositórios do usuário.',
    );
  }

  if (!response.ok) {
    throw new Error(`GitHub respondeu com HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function listOwnerRepositories(owner: string, headers: HeadersInit) {
  const repositories: GitHubRepositoryListItem[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubJson<GitHubRepositoryListItem[]>(
      `https://api.github.com/users/${encodeURIComponent(owner)}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`,
      headers,
    );
    repositories.push(...batch);
    if (batch.length < 100) break;
  }

  return repositories;
}

async function repositoryTree(
  repository: GitHubRepositoryListItem,
  headers: HeadersInit,
): Promise<TreeEntry[]> {
  const url =
    `https://api.github.com/repos/${repository.full_name}/git/trees/` +
    `${encodeURIComponent(repository.default_branch)}?recursive=1`;
  const response = await fetch(url, {
    headers,
    next: { revalidate: 3600 },
  });

  if (response.status === 409 || response.status === 404) return [];
  if (response.status === 403) {
    throw new Error('Limite da API do GitHub atingido durante a análise dos repositórios.');
  }
  if (!response.ok) {
    throw new Error(`GitHub respondeu com HTTP ${response.status} em ${repository.full_name}.`);
  }

  const data = (await response.json()) as GitHubTree;
  return data.tree
    .filter((entry) => entry.type === 'blob' || entry.type === 'tree')
    .map((entry) => ({
      path: entry.path,
      type: entry.type as 'blob' | 'tree',
      size: typeof entry.size === 'number' ? entry.size : null,
    }));
}

function scoreSignals(signals: Array<{ found: boolean }>) {
  if (!signals.length) return 0;
  const passed = signals.filter((signal) => signal.found).length;
  return Math.round((passed / signals.length) * 100);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scoreRepository(
  repository: GitHubRepositoryListItem,
  headers: HeadersInit,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const tree = await repositoryTree(repository, headers);
      const { signals } = await analyzeQualitySignals({
        owner: repository.owner.login,
        repo: repository.name,
        defaultBranch: repository.default_branch,
        tree,
        dependencies: [],
        repositoryLicense: repository.license,
      });

      return scoreSignals(signals);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(750 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Falha ao analisar ${repository.full_name}.`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: Array<PromiseSettledResult<R> | undefined> = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]!) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );

  return results.filter(
    (result): result is PromiseSettledResult<R> => result !== undefined,
  );
}

export async function analyzeOwnerQualityBatch(owner: string, offset: number, limit: number) {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner)) throw new Error('Usuário do GitHub inválido.');

  const headers = buildHeaders();
  const repositories = await listOwnerRepositories(owner, headers);
  const safeOffset = Math.max(0, Math.min(offset, repositories.length));
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const batch = repositories.slice(safeOffset, safeOffset + safeLimit);
  const settled = await mapWithConcurrency(batch, 2, (repository) =>
    scoreRepository(repository, headers),
  );
  const scored = settled.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? [{ name: batch[index]!.name, score: result.value }]
      : [],
  );
  const scores = scored.map((item) => item.score);

  if (scores.length !== batch.length) {
    throw new Error(`Falha no lote ${safeOffset + 1}-${safeOffset + batch.length}. Nenhuma média parcial será usada.`);
  }

  return {
    owner,
    totalRepositories: repositories.length,
    offset: safeOffset,
    processed: scores.length,
    scores,
    repositories: scored,
    nextOffset: safeOffset + scores.length,
    complete: safeOffset + scores.length >= repositories.length,
  };
}

export async function analyzeOwnerQuality(owner: string): Promise<OwnerQualitySummary> {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner)) {
    throw new Error('Usuário do GitHub inválido.');
  }

  const headers = buildHeaders();
  const repositories = await listOwnerRepositories(owner, headers);
  const settled = await mapWithConcurrency(repositories, 2, (repository) =>
    scoreRepository(repository, headers),
  );

  const scores = settled.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  if (scores.length !== repositories.length) {
    throw new Error(
      `Análise do owner incompleta: ${scores.length}/${repositories.length} repositórios. A média parcial não será exibida.`,
    );
  }

  const average = scores.length
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : null;

  return {
    owner,
    average,
    totalRepositories: repositories.length,
    analyzedRepositories: scores.length,
    complete: true,
    scope: 'public',
    analyzedAt: new Date().toISOString(),
  };
}
