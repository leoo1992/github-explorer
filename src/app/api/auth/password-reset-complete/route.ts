import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  PASSWORD_RECOVERY_COOKIE,
  verifyPasswordRecoveryProof,
} from '@/lib/password-recovery';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ error: 'Sessão de recuperação inválida.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const proof = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;

  if (!verifyPasswordRecoveryProof(proof, data.user.id)) {
    return NextResponse.json({ error: 'Recuperação de senha inválida ou expirada.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: {
      ...data.user.app_metadata,
      email_verified_manually: true,
    },
  });

  if (updateError) {
    return NextResponse.json({ error: 'Não foi possível concluir a recuperação.' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PASSWORD_RECOVERY_COOKIE);
  return response;
}
