import { NextRequest } from 'next/server';
import { requirePaidApiAccess } from '@/lib/access';
import { analyzeRepository } from '@/lib/github-analyzer';
import { sanitizeQualityCriteriaIds } from '@/lib/quality-criteria';
import { recordRepositoryUsage } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const gate = await requirePaidApiAccess();
  if (gate.response) return gate.response;
  if (!gate.access?.user) {
    return Response.json({ error: 'Acesso indisponível.' }, { status: 503 });
  }

  const userId = gate.access.user.id;
  const repo = request.nextUrl.searchParams.get('repo')?.trim();
  const rawCriteria = request.nextUrl.searchParams.get('criteria');
  const criteriaIds = rawCriteria
    ? sanitizeQualityCriteriaIds(rawCriteria.split(',').map((value) => value.trim()).filter(Boolean))
    : undefined;
  const usageBase = {
    userId,
    repository: repo ?? null,
    criteriaCount: criteriaIds?.length ?? null,
  };

  if (!repo) {
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
    const analysis = await analyzeRepository(repo, { criteriaIds });
    await recordRepositoryUsage({
      ...usageBase,
      state: 'complete',
      durationMs: Date.now() - startedAt,
    });
    return Response.json(analysis, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
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
