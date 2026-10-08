import { NextRequest } from 'next/server';
import { requireAnalysisApiAccess } from '@/lib/access';
import {
  claimFreeAnalysis,
  completeFreeAnalysis,
  releaseFreeAnalysisClaim,
} from '@/lib/entitlements';
import { analyzeRepository } from '@/lib/github-analyzer';
import { applyGlobalRatePause, globalRatePauseSeconds, cacheContext, claimAnalysis, currentCommit, readAnalysisCache, releaseAnalysis, saveAnalysis, type CacheContext } from '@/lib/analysis-queue';
import { calculateQualityScore, sanitizeQualityCriteriaIds } from '@/lib/quality-criteria';
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

  let cache: CacheContext | null = null;
  try {
    const pause = await globalRatePauseSeconds();
    if (pause > 0) {
      if (usingFreeAnalysis) await releaseFreeAnalysisClaim(userId);
      return Response.json({ state: 'waiting', code: 'GITHUB_RATE_LIMIT', retryAfterMs: pause * 1000 }, { status: 202, headers: { 'cache-control': 'private, no-store', 'retry-after': String(pause) } });
    }
    const head = await currentCommit(repo);
    cache = cacheContext(head.repo, head.sha, mode, criteriaIds ?? []);
    const cached = await readAnalysisCache(cache);
    if (cached) {
      if (usingFreeAnalysis) await completeFreeAnalysis(userId);
      return Response.json(cached, { headers: { 'cache-control': 'private, no-store', 'x-analysis-cache': 'hit' } });
    }
    const claim = await claimAnalysis(cache);
    if (claim !== 'claimed') {
      if (usingFreeAnalysis) await releaseFreeAnalysisClaim(userId);
      return Response.json({
        state: 'waiting',
        code: claim === 'rate_limited' ? 'GITHUB_RATE_LIMIT' : 'ANALYSIS_QUEUED',
        retryAfterMs: claim === 'rate_limited' ? 60000 : 8000,
        error: claim === 'rate_limited' ? 'Cota GitHub em recuperação.' : 'Análise aguardando uma vaga na fila compartilhada.',
      }, { status: 202, headers: { 'cache-control': 'private, no-store', 'retry-after': claim === 'rate_limited' ? '60' : '8' } });
    }
    const analysis = await analyzeRepository(repo, { criteriaIds, mode, profileLabel });
    await saveAnalysis(cache, analysis);

    const quality = calculateQualityScore(
      analysis.qualitySignals,
      analysis.appliedCriteriaIds,
      analysis.languages.map((language) => language.name),
    );

    await recordRepositoryUsage({
      ...usageBase,
      criteriaCount: analysis.appliedCriteriaIds.length,
      qualityScore: quality.score,
      qualityProfile: analysis.qualityProfile,
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

    const originalMessage = error instanceof Error ? error.message : 'unknown';
    const message = /^GitHub respondeu com HTTP (403|429)\./.test(originalMessage)
      ? 'GITHUB_RATE_LIMIT: aguardar 60s (qualidade)'
      : originalMessage;
    if (cache) await releaseAnalysis(cache, message);
    else await applyGlobalRatePause(message);
    console.error('[repository-analysis] request deferred', { repo, message });

    const notFound = /não encontrado|not found/i.test(message);
    const invalidInput = /owner\/repository|URL completa/i.test(message);
    const githubAuthInvalid = message.startsWith('GITHUB_AUTH_INVALID:');
    const rateLimitMatch = message.match(/^GITHUB_RATE_LIMIT: aguardar (\d+)s/);

    if (githubAuthInvalid) {
      await recordRepositoryUsage({
        ...usageBase,
        state: 'waiting',
        durationMs: Date.now() - startedAt,
      });
      return Response.json(
        {
          state: 'error',
          code: 'GITHUB_AUTH_INVALID',
          error: 'A integração com o GitHub precisa de um token válido. Verifique GITHUB_TOKEN na Vercel.',
        },
        { status: 503, headers: { 'cache-control': 'private, no-store' } },
      );
    }

    if (rateLimitMatch) {
      const seconds = Math.max(60, Math.min(3600, Number(rateLimitMatch[1])));
      await recordRepositoryUsage({
        ...usageBase,
        state: 'waiting',
        durationMs: Date.now() - startedAt,
      });
      return Response.json(
        {
          state: 'waiting',
          code: 'GITHUB_RATE_LIMIT',
          error: 'Limite temporário da API do GitHub atingido. A análise será retomada após a espera.',
          retryAfterMs: seconds * 1000,
        },
        {
          status: 202,
          headers: { 'cache-control': 'private, no-store', 'retry-after': String(seconds) },
        },
      );
    }

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
