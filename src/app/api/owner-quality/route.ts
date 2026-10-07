import { NextRequest } from 'next/server';
import { requirePaidApiAccess } from '@/lib/access';
import { sanitizeQualityCriteriaIds } from '@/lib/quality-criteria';
import { analyzeOwnerQuality, analyzeOwnerQualityBatch } from '@/lib/owner-quality';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function requestedCriteria(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('criteria');
  if (!raw) return undefined;
  return sanitizeQualityCriteriaIds(raw.split(',').map((value) => value.trim()).filter(Boolean));
}

export async function GET(request: NextRequest) {
  const gate = await requirePaidApiAccess();
  if (gate.response) return gate.response;

  const owner = request.nextUrl.searchParams.get('owner')?.trim();
  if (!owner || !/^[A-Za-z0-9_.-]+$/.test(owner)) {
    return Response.json(
      { state: 'input' },
      { status: 422, headers: { 'cache-control': 'private, no-store' } },
    );
  }

  try {
    const criteria = requestedCriteria(request);
    const offsetParam = request.nextUrl.searchParams.get('offset');
    const limitParam = request.nextUrl.searchParams.get('limit');

    if (offsetParam !== null || limitParam !== null) {
      const offset = Number.parseInt(offsetParam ?? '0', 10);
      const limit = Number.parseInt(limitParam ?? '5', 10);
      const batch = await analyzeOwnerQualityBatch(
        owner,
        Number.isFinite(offset) ? offset : 0,
        Number.isFinite(limit) ? limit : 5,
        criteria,
      );
      return Response.json(batch, {
        headers: { 'cache-control': 'private, no-store' },
      });
    }

    const summary = await analyzeOwnerQuality(owner, criteria);
    return Response.json(summary, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[owner-quality] request deferred', {
      owner,
      message: error instanceof Error ? error.message : 'unknown',
    });

    const notFound = error instanceof Error && /não encontrado/i.test(error.message);
    if (notFound) {
      return Response.json(
        { state: 'not_found' },
        { status: 404, headers: { 'cache-control': 'private, no-store' } },
      );
    }

    return Response.json(
      { state: 'waiting', retryAfterMs: 30_000 },
      { status: 202, headers: { 'cache-control': 'private, no-store', 'retry-after': '30' } },
    );
  }
}
