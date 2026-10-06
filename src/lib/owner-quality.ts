import { analyzeQualitySignals } from '@/lib/quality-analyzer';
import { qualityCriterionLabels, sanitizeQualityCriteriaIds } from '@/lib/quality-criteria';
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

class GitHubRequestError extends Error {
  status: number;
  retryAfterMs: number;
  retryable: boolean;

  constructor(message: string, status: number, retryAfterMs = 0, retryable = false) {
    super(message);
    this.name = 'GitHubRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.retryable = retryable;
  }
}

const LIVE_CI_LABELS = new Set([
  'Pipeline completo verde',
  'Lint realmente passa',
  'Testes passam',
  'Build passa',
]);

function buildHeaders() {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'reposcope',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function retryAfterMs(response: Response) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
  }

  const reset = response.headers.get('x-ratelimit-reset');
  if (reset) {
    const epochSeconds = Number.parseInt(reset, 10);
    if (Number.isFinite(epochSeconds)) {
      return Math.max(1_000, epochSeconds * 1_000 - Date.now() + 1_500);
    }
  }

  return 2_500;
}

function responseError(response: Response, context: string) {
  const retryable = response.status === 403 || response.status === 429 || response.status >= 500;
  return new GitHubRequestError(
    `${context} · HTTP ${response.status}`,
    response.status,
    retryable ? retryAfterMs(response) : 0,
    retryable,
  );
}

async function githubJson<T>(url: string, headers: HeadersInit): Promise<T> {
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 404) {
    throw new GitHubRequestError('Recurso público não encontrado no GitHub.', 404, 0, false);
  }
  if (!response.ok) throw responseError(response, 'GitHub indisponível para esta etapa');
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

async function repositoryTree(repository: GitHubRepositoryListItem, headers: HeadersInit): Promise<TreeEntry[]> {
  const url =
    `https://api.github.com/repos/${repository.full_name}/git/trees/` +
    `${encodeURIComponent(repository.default_branch)}?recursive=1`;
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 409 || response.status === 404) return [];
  if (!response.ok) throw responseError(response, `Árvore de ${repository.full_name} temporariamente indisponível`);

  const data = (await response.json()) as GitHubTree;
  return data.tree
    .filter((entry) => entry.type === 'blob' || entry.type === 'tree')
    .map((entry) => ({
      path: entry.path,
      type: entry.type as 'blob' | 'tree',
      size: typeof entry.size === 'number' ? entry.size : null,
    }));
}

function scoreSignals(signals: Array<{ label: string; found: boolean }>, criterionIds: string[]) {
  const labels = qualityCriterionLabels(criterionIds);
  const selected = signals.filter((signal) => labels.has(signal.label));
  if (!selected.length) return 0;
  const passed = selected.filter((signal) => signal.found).length;
  return Math.round((passed / selected.length) * 100);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scoreRepository(
  repository: GitHubRepositoryListItem,
  headers: HeadersInit,
  criterionIds: string[],
) {
  let lastError: unknown;
  const selectedLabels = qualityCriterionLabels(criterionIds);
  const needsLiveCi = [...LIVE_CI_LABELS].some((label) => selectedLabels.has(label));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const tree = await repositoryTree(repository, headers);
      const result = await analyzeQualitySignals({
        owner: repository.owner.login,
        repo: repository.name,
        defaultBranch: repository.default_branch,
        tree,
        dependencies: [],
        repositoryLicense: repository.license,
      });

      const hasGitHubActions = result.signals.some(
        (signal) => signal.label === 'GitHub Actions' && signal.found,
      );
      if (needsLiveCi && hasGitHubActions && result.remaining.length === 0) {
        throw new GitHubRequestError(
          'Evidência de CI temporariamente indisponível; reprocessamento necessário.',
          503,
          3_000,
          true,
        );
      }

      return scoreSignals(result.signals, criterionIds);
    } catch (error) {
      lastError = error;
      const wait = error instanceof GitHubRequestError ? error.retryAfterMs : 750 * 2 ** attempt;
      if (error instanceof GitHubRequestError && (!error.retryable || wait > 8_000)) break;
      if (attempt < 3) await delay(Math.min(Math.max(wait, 500), 8_000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Etapa de análise temporariamente indisponível.');
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
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

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results.filter((result): result is PromiseSettledResult<R> => result !== undefined);
}

function retryDelayFromSettled(results: PromiseSettledResult<number>[]) {
  const delays = results.flatMap((result) => {
    if (result.status === 'fulfilled') return [];
    const reason = result.reason;
    return reason instanceof GitHubRequestError && reason.retryable ? [reason.retryAfterMs] : [2_500];
  });
  return delays.length ? Math.min(Math.max(...delays), 60 * 60 * 1_000) : 0;
}

export async function analyzeOwnerQualityBatch(
  owner: string,
  offset: number,
  limit: number,
  requestedCriterionIds?: string[],
) {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner)) throw new Error('Owner inválido.');

  const criterionIds = sanitizeQualityCriteriaIds(requestedCriterionIds);
  const headers = buildHeaders();
  const repositories = await listOwnerRepositories(owner, headers);
  const safeOffset = Math.max(0, Math.min(offset, repositories.length));
  const safeLimit = Math.max(1, Math.min(limit, 12));
  const batch = repositories.slice(safeOffset, safeOffset + safeLimit);
  const settled = await mapWithConcurrency(batch, 3, (repository) =>
    scoreRepository(repository, headers, criterionIds),
  );

  const scored = settled.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? [{ name: batch[index]!.name, score: result.value, offset: safeOffset + index }]
      : [],
  );
  const pendingOffsets = settled.flatMap((result, index) =>
    result.status === 'rejected' ? [safeOffset + index] : [],
  );
  const nextOffset = safeOffset + batch.length;

  if (pendingOffsets.length) {
    console.warn('[owner-quality] deferred repositories', {
      owner,
      pendingOffsets,
      retryAfterMs: retryDelayFromSettled(settled),
    });
  }

  return {
    owner,
    totalRepositories: repositories.length,
    offset: safeOffset,
    attempted: batch.length,
    successful: scored.length,
    scores: scored.map((item) => item.score),
    repositories: scored,
    pendingOffsets,
    retryAfterMs: retryDelayFromSettled(settled),
    nextOffset,
    scanComplete: nextOffset >= repositories.length,
    complete: nextOffset >= repositories.length && pendingOffsets.length === 0,
    criteria: criterionIds,
  };
}

export async function analyzeOwnerQuality(
  owner: string,
  requestedCriterionIds?: string[],
): Promise<OwnerQualitySummary> {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner)) throw new Error('Owner inválido.');

  const criterionIds = sanitizeQualityCriteriaIds(requestedCriterionIds);
  const headers = buildHeaders();
  const repositories = await listOwnerRepositories(owner, headers);
  const settled = await mapWithConcurrency(repositories, 3, (repository) =>
    scoreRepository(repository, headers, criterionIds),
  );
  const scoredRepositories = settled.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? [{ name: repositories[index]!.name, score: result.value }]
      : [],
  );
  const complete = scoredRepositories.length === repositories.length;
  const scores = scoredRepositories.map((item) => item.score);
  const average = complete && scores.length
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : null;

  if (!complete) {
    console.warn('[owner-quality] full analysis deferred', {
      owner,
      analyzed: scoredRepositories.length,
      total: repositories.length,
    });
  }

  return {
    owner,
    average,
    totalRepositories: repositories.length,
    analyzedRepositories: scoredRepositories.length,
    complete,
    scope: 'public',
    analyzedAt: new Date().toISOString(),
    repositories: scoredRepositories,
  };
}
