import { NextRequest } from 'next/server';
import { requireAnalysisApiAccess } from '@/lib/access';
import { applyGlobalRatePause, globalRatePauseSeconds } from '@/lib/analysis-queue';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const gate = await requireAnalysisApiAccess();
  if (gate.response) return gate.response;
  if (!gate.access || !(gate.access.admin || gate.access.paid || gate.access.freeGrantActive)) {
    return Response.json({ error: 'Análise em lote exige acesso ativo.' }, { status: 402 });
  }
  const owner = request.nextUrl.searchParams.get('owner')?.trim() ?? '';
  if (!/^[\w.-]{1,39}$/.test(owner)) return Response.json({ error: 'Owner inválido.' }, { status: 422 });
  const pause = await globalRatePauseSeconds();
  if (pause > 0) return Response.json({ error: 'Cota do GitHub em recuperação.', retryAfterMs: pause * 1000 }, { status: 429 });
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&type=owner&sort=full_name`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'RepoScope-batch',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    next: { revalidate: 180 }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if ([403,429].includes(response.status)) {
      const seconds = Math.max(60, Math.min(3600, Number(response.headers.get('retry-after')) ||
        Number(response.headers.get('x-ratelimit-reset')) - Math.floor(Date.now()/1000) || 60));
      await applyGlobalRatePause(`GITHUB_RATE_LIMIT: aguardar ${Math.ceil(seconds)}s`);
      return Response.json({ error: 'Limite da API do GitHub atingido.', retryAfterMs: seconds * 1000 }, { status: 429 });
    }
    return Response.json({ error: `GitHub retornou HTTP ${response.status}.` }, { status: response.status });
  }
  const data = await response.json() as Array<{ name: string; full_name: string; archived: boolean; private: boolean }>;
  return Response.json({ repositories: data.filter(r=>!r.private).map(r=>r.full_name), truncated: data.length===100 },
    { headers: { 'cache-control': 'private, no-store' } });
}
