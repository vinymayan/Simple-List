import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/session';
import { listUserCollections } from '@/lib/nexus-collections';

export async function GET() {
  try {
    const apiKey = await getApiKeyFromCookie();
    if (!apiKey) return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });

    const result = await listUserCollections(apiKey);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Could not load collections.', details: error?.payload },
      { status: error?.status || 500 }
    );
  }
}
