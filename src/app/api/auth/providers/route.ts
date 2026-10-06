import { NextResponse } from 'next/server';

type ProviderSettings = {
  external?: {
    google?: boolean;
    azure?: boolean;
  };
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return NextResponse.json(
      { google: false, azure: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: publishableKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) {
      return NextResponse.json(
        { google: false, azure: false },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const settings = (await response.json()) as ProviderSettings;

    return NextResponse.json(
      {
        google: settings.external?.google === true,
        azure: settings.external?.azure === true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { google: false, azure: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
