import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/session';
import { getModFiles } from '@/lib/nexus';

type Context = { params: Promise<{ game: string; modId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const apiKey = await getApiKeyFromCookie();
    if (!apiKey) return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });

    const { game, modId } = await context.params;
    const files = await getModFiles(apiKey, game, Number(modId));
    return NextResponse.json({ files });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Could not load mod files.', details: error?.payload },
      { status: error?.status || 500 }
    );
  }
}
