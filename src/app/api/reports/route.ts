import { NextRequest } from 'next/server';
import { getAccessState } from '@/lib/access';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RepositoryAnalysis } from '@/types/repository';

export const dynamic = 'force-dynamic';

function isRepositoryAnalysis(value: unknown): value is RepositoryAnalysis {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RepositoryAnalysis>;
  return Boolean(
    candidate.repository?.owner &&
    candidate.repository?.name &&
    Array.isArray(candidate.qualitySignals) &&
    Array.isArray(candidate.appliedCriteriaIds),
  );
}

export async function POST(request: NextRequest) {
  const access = await getAccessState();
  if (!access.user) {
    return Response.json({ error: 'Faça login para compartilhar relatórios.' }, { status: 401 });
  }
  if (!access.canAnalyze) {
    return Response.json({ error: 'Seu acesso atual não permite compartilhar novas análises.' }, { status: 402 });
  }

  let payload: { analysis?: unknown; qualityScore?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  if (!isRepositoryAnalysis(payload.analysis)) {
    return Response.json({ error: 'Análise inválida.' }, { status: 422 });
  }

  const serialized = JSON.stringify(payload.analysis);
  if (serialized.length > 1_500_000) {
    return Response.json({ error: 'Relatório excede o tamanho máximo permitido.' }, { status: 413 });
  }

  const score = typeof payload.qualityScore === 'number'
    ? Math.max(0, Math.min(100, Math.round(payload.qualityScore)))
    : null;
  const slug = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().slice(0, 8);
  const supabase = createAdminClient();

  const { error } = await supabase.from('shared_reports').insert({
    slug,
    user_id: access.user.id,
    repository: payload.analysis.repository.fullName,
    quality_score: score,
    quality_profile: payload.analysis.qualityProfile,
    analysis: payload.analysis,
  });

  if (error) {
    console.error('[shared-report] insert failed', error.message);
    return Response.json({ error: 'Não foi possível criar o relatório compartilhável.' }, { status: 500 });
  }

  return Response.json(
    {
      slug,
      url: `${request.nextUrl.origin}/report/${slug}`,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
