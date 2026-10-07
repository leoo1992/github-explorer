import { NextRequest } from 'next/server';
import { requireAnalysisApiAccess } from '@/lib/access';
import {
  claimFreeAnalysis,
  completeFreeAnalysis,
  releaseFreeAnalysisClaim,
} from '@/lib/entitlements';
import { analyzeRepository } from '@/lib/github-analyzer';
import { sanitizeQualityCriteriaIds } from '@/lib/quality-criteria';
import { recordRepositoryUsage } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const gate = await requireAnalysisApiAccess();
  if (gate.response) return gate.response;
  if (!gate.access?.user) {
    return Response.json({ error: 'Acesso indisponível.' }, { status: 503 });
  }

  const userId = gate.access.user.id;
  const usingFreeAnalysis =
    gate.access.freeAnalysisAvailable &&
    !gate.access.admin &&
    !gate.access.paid &&
    !gate.access.freeGrantActive;

  if (usingFreeAnalysis) {
    const claimed = await claimFreeAnalysis(userId);
    if (!claimed) {
      return Response.json(
        { error: 'Sua análise gratuita já foi utilizada ou está em processamento.', code: 'PAYMENT_REQUIRED' },
        { status: 402, headers: { 'cache-control': 'private, no-store' } },
      );
    }
  }

  const repo = request.nextUrl.searchParams.get('repo')?.trim();
  const mode = request.nextUrl.searchParams.get('mode') === 'auto' ? 'auto' : 'selected';
  const profileLabel = request.nextUrl.searchParams.get('profile')?.trim() || undefined;
  const rawCriteria = request.nextUrl.searchParams.get('criteria');
  const criteriaIds = mode === 'selected' && rawCriteria
    ? sanitizeQualityCriteriaIds(rawCriteria.split(',').map((value) => value.trim()).filter(Boolean))
    : undefined;
  const usageBase = {
    userId,
    repository: repo ?? null,
    criteriaCount: criteriaIds?.length ?? null,
  };

  if (!repo) {
    if (usingFreeAnalysis) await releaseFreeAnalysisClaim(userId);
    await recordRepositoryUsage({
      ...usageBase,
      state: 'input',
      durationMs: Date.now() - startedAt,
    });
    return Response.json(
      { state: 'input' },
      { status: 422, headers: { 'cache-control': 'private, no-store' } },
    );
  }

  try {
    const analysis = await analyzeRepository(repo, { criteriaIds, mode, profileLabel });

    await recordRepositoryUsage({
      ...usageBase,
      criteriaCount: analysis.appliedCriteriaIds.length,
      state: 'complete',
      durationMs: Date.now() - startedAt,
    });

    if (usingFreeAnalysis) {
      await completeFreeAnalysis(userId);
    }

    return Response.json(analysis, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    if (usingFreeAnalysis) await releaseFreeAnalysisClaim(userId);

    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[repository-analysis] request deferred', { repo, message });

    const notFound = /não encontrado|not found/i.test(message);
    const invalidInput = /owner\/repository|URL completa/i.test(message);

    if (invalidInput) {
      await recordRepositoryUsage({
        ...usageBase,
        state: 'input',
        durationMs: Date.now() - startedAt,
      });
      return Response.json(
        { state: 'input' },
        { status: 422, headers: { 'cache-control': 'private, no-store' } },
      );
    }

    if (notFound) {
      await recordRepositoryUsage({
        ...usageBase,
        state: 'not_found',
        durationMs: Date.now() - startedAt,
      });
      return Response.json(
        { state: 'not_found' },
        { status: 404, headers: { 'cache-control': 'private, no-store' } },
      );
    }

    await recordRepositoryUsage({
      ...usageBase,
      state: 'waiting',
      durationMs: Date.now() - startedAt,
    });
    return Response.json(
      { state: 'waiting', retryAfterMs: 5_000 },
      { status: 202, headers: { 'cache-control': 'private, no-store', 'retry-after': '5' } },
    );
  }
}
