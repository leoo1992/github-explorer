import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RepositoryAnalysis } from '@/types/repository';

const db = () => createAdminClient();
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const GH_HEADERS = () => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'RepoScope-cache',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

export type CacheContext = { repo: string; sha: string; key: string; job: string; profile: string };

export async function currentCommit(repoInput: string): Promise<{ repo: string; sha: string }> {
  const match = repoInput.match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/i);
  if (!match) throw new Error('Informe owner/repository ou a URL completa de um repositório público do GitHub.');
  const repo = `${match[1]}/${match[2]}`.toLowerCase();
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: GH_HEADERS(), next: { revalidate: 120 }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('GITHUB_AUTH_INVALID: HTTP 401');
    if ([403,429].includes(response.status)) {
      const seconds = Math.max(60, Math.min(3600, Number(response.headers.get('retry-after')) ||
        (Number(response.headers.get('x-ratelimit-reset')) - Math.floor(Date.now()/1000)) || 60));
      throw new Error(`GITHUB_RATE_LIMIT: aguardar ${Math.ceil(seconds)}s`);
    }
    if (response.status === 404) throw new Error('Repositório público não encontrado.');
    throw new Error(`GitHub respondeu com HTTP ${response.status}.`);
  }
  const metadata = await response.json() as { default_branch: string };
  const headResponse = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(metadata.default_branch)}`, {
    headers: GH_HEADERS(), next: { revalidate: 120 }, signal: AbortSignal.timeout(15000),
  });
  if (!headResponse.ok) {
    if ([403,429].includes(headResponse.status)) {
      const seconds = Math.max(60, Math.min(3600, Number(headResponse.headers.get('retry-after')) ||
        (Number(headResponse.headers.get('x-ratelimit-reset')) - Math.floor(Date.now()/1000)) || 60));
      throw new Error(`GITHUB_RATE_LIMIT: aguardar ${Math.ceil(seconds)}s`);
    }
    throw new Error(`GitHub commit HTTP ${headResponse.status}.`);
  }
  const head = await headResponse.json() as { sha: string };
  return { repo, sha: head.sha };
}

export function cacheContext(repo: string, sha: string, mode: string, criteria: string[]): CacheContext {
  const profile = digest(JSON.stringify({ mode, criteria: [...criteria].sort() }));
  const key = digest(`${repo}:${sha}:${profile}:v2`);
  return { repo, sha, profile, key, job: digest(`${repo}:${sha}:${profile}`) };
}

export async function readAnalysisCache(ctx: CacheContext): Promise<RepositoryAnalysis | null> {
  const { data, error } = await db().from('analysis_cache').select('payload').eq('cache_key', ctx.key).maybeSingle();
  if (error) throw new Error(`Cache indisponível: ${error.message}`);
  return (data?.payload ?? null) as RepositoryAnalysis | null;
}

export async function claimAnalysis(ctx: CacheContext) {
  const { data, error } = await db().rpc('claim_analysis_job', {
    p_key: ctx.job, p_repository: ctx.repo, p_profile: ctx.profile, p_slots: 2,
  });
  if (error) throw new Error(`Fila indisponível: ${error.message}`);
  return data as 'claimed' | 'queued' | 'busy' | 'rate_limited' | 'complete';
}

export async function saveAnalysis(ctx: CacheContext, analysis: RepositoryAnalysis) {
  const client = db();
  const { error } = await client.from('analysis_cache').upsert({
    cache_key: ctx.key, repository: ctx.repo, commit_sha: ctx.sha,
    profile_key: ctx.profile, payload: analysis, last_accessed_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' });
  if (error) throw new Error(`Falha ao persistir resultado: ${error.message}`);
  await client.from('analysis_jobs').update({
    status: 'complete', result_key: ctx.key, leased_until: null,
    updated_at: new Date().toISOString(),
  }).eq('job_key',ctx.job);
}

export async function releaseAnalysis(ctx: CacheContext, message: string) {
  const client = db();
  const seconds = Number(message.match(/^GITHUB_RATE_LIMIT: aguardar (\d+)s/)?.[1]);
  if (Number.isFinite(seconds) && seconds > 0) {
    await client.rpc('pause_github_analysis', { p_seconds: seconds });
  }
  await client.from('analysis_jobs').update({
    status: /^GITHUB_RATE_LIMIT/.test(message) ? 'waiting' : 'error',
    error_message: message.slice(0,300), leased_until: null,
    updated_at: new Date().toISOString(),
  }).eq('job_key', ctx.job);
}

export async function getPartialResults(repos: string[]) {
  if (!repos.length) return [];
  const { data, error } = await db().from('analysis_jobs')
    .select('repository,status,result_key,updated_at,error_message')
    .in('repository', repos.slice(0,100).map(x=>x.toLowerCase()));
  if (error) throw new Error(`Fila indisponível: ${error.message}`);
  return data ?? [];
}

export async function globalRatePauseSeconds() {
  const { data, error } = await db().from('analysis_control').select('pause_until').eq('id', 1).single();
  if (error) throw new Error(`Controle de cota indisponível: ${error.message}`);
  return Math.max(0, Math.ceil((new Date(data.pause_until).getTime() - Date.now()) / 1000));
}
export async function applyGlobalRatePause(message: string) {
  const seconds = Number(message.match(/^GITHUB_RATE_LIMIT: aguardar (\d+)s/)?.[1]);
  if (Number.isFinite(seconds) && seconds > 0) {
    await db().rpc('pause_github_analysis', { p_seconds: seconds });
  }
}
