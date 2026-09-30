import { NextRequest } from 'next/server';
import { analyzeOwnerQuality } from '@/lib/owner-quality';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get('owner')?.trim();

  if (!owner) {
    return Response.json(
      { error: 'Informe o parâmetro owner.' },
      { status: 400 },
    );
  }

  try {
    const summary = await analyzeOwnerQuality(owner);
    return Response.json(summary, {
      headers: {
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível calcular a média do usuário.',
      },
      { status: 400 },
    );
  }
}
