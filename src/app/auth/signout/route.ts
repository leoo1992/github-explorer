import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Mesmo sem configuração, encerra o fluxo voltando para a landing.
  }

  revalidatePath('/', 'layout');
  return NextResponse.redirect(new URL('/', request.url), { status: 302 });
}
