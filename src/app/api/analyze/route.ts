import { NextRequest } from 'next/server';
import { requirePaidApiAccess } from '@/lib/access';
import { analyzeRepository } from '@/lib/github-analyzer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await requirePaidApiAccess();
  if (gate.response) return gate.response;

  const repo = request.nextUrl.searchParams.get('repo')?.trim();
  const mode = request.nextUrl.searchParams.get('mode')?.trim();

  if (!repo) {
    return Response.json(
      { state: 'input' },
      { status: 422, headers: { 'cache-control': 'private, no-store' } },
    );
  }

  try {
    const analysis = await analyzeRepository(repo, {
      allowProjectLookup: mode === 'project',
    });
    return Response.json(analysis, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('[repository-analysis] request deferred', { repo, mode, message });

    const notFound = /não encontrado|not found|nenhum repositório/i.test(message);
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
