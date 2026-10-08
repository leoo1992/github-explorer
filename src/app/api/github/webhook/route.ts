import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook não configurado.' }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  if (!signature || signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return Response.json({ error: 'Assinatura inválida.' }, { status: 401 });
  }
  const event = request.headers.get('x-github-event');
  const delivery = request.headers.get('x-github-delivery');
  if (!delivery || !/^[a-f0-9-]{20,}$/i.test(delivery)) return Response.json({ error: 'Entrega inválida.' }, { status: 422 });
  if (!['ping','push','installation','installation_repositories'].includes(event ?? '')) {
    return Response.json({ accepted: true, ignored: true });
  }
  // Cache é identificado por SHA. Novo push gera outra chave sem invalidar resultados históricos.
  // Tokens são emitidos sob demanda, para respeitar permissões das instalações atuais.
  return Response.json({ accepted: true, event });
}
