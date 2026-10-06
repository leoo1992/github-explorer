import { NextRequest } from 'next/server';
import { requirePaidApiAccess } from '@/lib/access';
import { analyzeOwnerQuality, analyzeOwnerQualityBatch } from '@/lib/owner-quality';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const gate = await requirePaidApiAccess();
  if (gate.response) return gate.response;

  const owner = request.nextUrl.searchParams.get('owner')?.trim();

  if (!owner) {
    return Response.json({ error: 'Informe o parâmetro owner.' }, { status: 400 });
  }

  try {
    const offsetParam = request.nextUrl.searchParams.get('offset');
    const limitParam = request.nextUrl.searchParams.get('limit');

    if (offsetParam !== null || limitParam !== null) {
      const offset = Number.parseInt(offsetParam ?? '0', 10);
      const limit = Number.parseInt(limitParam ?? '5', 10);
      const batch = await analyzeOwnerQualityBatch(
        owner,
        Number.isFinite(offset) ? offset : 0,
        Number.isFinite(limit) ? limit : 5,
      );
      return Response.json(batch, {
        headers: { 'cache-control': 'private, no-store' },
      });
    }

    const summary = await analyzeOwnerQuality(owner);
    return Response.json(summary, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Não foi possível calcular a média do usuário.',
      },
      { status: 400, headers: { 'cache-control': 'private, no-store' } },
    );
  }
}
