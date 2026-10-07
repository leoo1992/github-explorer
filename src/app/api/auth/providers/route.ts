import { NextResponse } from 'next/server';
import { getAuthProviderAvailability } from '@/lib/auth-providers';

export async function GET() {
  const providers = await getAuthProviderAvailability();

  return NextResponse.json(providers, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
