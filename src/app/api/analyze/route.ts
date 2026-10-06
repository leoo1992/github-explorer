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
    return Response.json({ error: 'Informe o parâmetro repo.' }, { status: 400 });
  }

  try {
    const analysis = await analyzeRepository(repo, {
      allowProjectLookup: mode === 'project',
    });
    return Response.json(analysis, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Não foi possível analisar o repositório.',
      },
      { status: 400, headers: { 'cache-control': 'private, no-store' } },
    );
  }
}
