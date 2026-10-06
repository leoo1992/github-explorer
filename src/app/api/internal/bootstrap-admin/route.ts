import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse('Not found', { status: 404 });
  }

  const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const token = new URL(request.url).searchParams.get('token');

  if (!expectedToken || !email || !password || token !== expectedToken) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'admin',
        billing_exempt: true,
      },
    });

    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? 'Não foi possível criar o administrador.' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      );
    }

    const { error: accessError } = await admin.from('subscriptions').upsert({
      user_id: data.user.id,
      status: 'active',
      price_id: 'internal_admin',
      updated_at: new Date().toISOString(),
    });

    if (accessError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        { ok: false, error: 'Conta criada, mas a liberação administrativa falhou; a conta foi revertida.' },
        { status: 500, headers: { 'cache-control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, user_id: data.user.id, email: data.user.email, role: 'admin' },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bootstrap indisponível.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
