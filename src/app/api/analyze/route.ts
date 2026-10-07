import { NextRequest } from 'next/server';
import { requirePaidApiAccess } from '@/lib/access';
import { analyzeRepository } from '@/lib/github-analyzer';
import { sanitizeQualityCriteriaIds } from '@/lib/quality-criteria';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await requirePaidApiAccess();
  if (gate.response) return gate.response;

  const repo = request.nextUrl.searchParams.get('repo')?.trim();
  const rawCriteria = request.nextUrl.searchParams.get('criteria');
  const criteriaIds = rawCriteria
    ? sanitizeQualityCriteriaIds(rawCriteria.split(',').map((value) => value.trim()).filter(Boolean))
    : undefined;

  if (!repo) {
    return Response.json(
      { state: 'input' },
      { status: 422, headers: { 'cache-control': 'private, no-store' } },
    );
  }

  try {
    const analysis = await analyzeRepository(repo, { criteriaIds });
    return Response.json(analysis, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[repository-analysis] request deferred', { repo, message });

    const notFound = /não encontrado|not found/i.test(message);
    const invalidInput = /owner\/repository|URL completa/i.test(message);

    if (invalidInput) {
      return Response.json(
        { state: 'input' },
        { status: 422, headers: { 'cache-control': 'private, no-store' } },
      );
    }

    if (notFound) {
      return Response.json(
        { state: 'not_found' },
        { status: 404, headers: { 'cache-control': 'private, no-store' } },
      );
    }

    return Response.json(
      { state: 'waiting', retryAfterMs: 5_000 },
      { status: 202, headers: { 'cache-control': 'private, no-store', 'retry-after': '5' } },
    );
  }
}
