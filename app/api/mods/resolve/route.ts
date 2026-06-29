import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/session';
import { extractNexusModUrl, getMod } from '@/lib/nexus';

export async function GET(request: Request) {
  try {
    const apiKey = await getApiKeyFromCookie();
    if (!apiKey) return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });

    const url = new URL(request.url);
    const value = url.searchParams.get('url') || '';
    const parsed = extractNexusModUrl(value);
    if (!parsed) return NextResponse.json({ message: 'Invalid Nexus mod URL.' }, { status: 400 });

    const mod = await getMod(apiKey, parsed.game, parsed.modId);
    return NextResponse.json({ mod });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Could not resolve URL.', details: error?.payload },
      { status: error?.status || 500 }
    );
  }
}
