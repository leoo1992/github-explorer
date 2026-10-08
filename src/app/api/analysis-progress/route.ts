import { NextRequest } from 'next/server';
import { requireAnalysisApiAccess } from '@/lib/access';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateQualityScore } from '@/lib/quality-criteria';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await requireAnalysisApiAccess();
  if (gate.response) return gate.response;
  const repos = (request.nextUrl.searchParams.get('repos') ?? '')
    .split(',').map(v => v.trim().toLowerCase())
    .filter(v => /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(v)).slice(0, 100);
  if (!repos.length) return Response.json({ items: [] });
  const client = createAdminClient();
  const { data: jobs, error } = await client.from('analysis_jobs')
    .select('repository,status,result_key,updated_at')
    .in('repository', repos)
    .order('updated_at', { ascending: false }).limit(200);
  if (error) return Response.json({ error: 'Fila de análises indisponível.' }, { status: 503 });
  const keys = [...new Set((jobs ?? []).map(item => item.result_key).filter((v): v is string => typeof v === 'string'))].slice(0, 100);
  const cached = keys.length ? await client.from('analysis_cache').select('cache_key,payload').in('cache_key', keys) : { data: [], error: null };
  if (cached.error) return Response.json({ error: 'Cache de análises indisponível.' }, { status: 503 });
  const scores = new Map((cached.data ?? []).map(item => {
    const value = item.payload as import('@/types/repository').RepositoryAnalysis;
    const quality = calculateQualityScore(value.qualitySignals,value.appliedCriteriaIds,value.languages.map(v => v.name));
    return [item.cache_key, quality.score] as const;
  }));
  const seen = new Set<string>();
  const items = (jobs ?? []).filter(item => !seen.has(item.repository) && seen.add(item.repository))
    .map(item => ({ repository: item.repository, status: item.status,
      score: item.result_key ? (scores.get(item.result_key) ?? null) : null,
      updatedAt: item.updated_at }));
  return Response.json({ items, completed: items.filter(item => item.status === 'complete').length,
    pending: items.filter(item => item.status !== 'complete').length },
    { headers: { 'cache-control': 'private, no-store' } });
}
