import { NextResponse } from 'next/server';
import { setApiKeyCookie } from '@/lib/session';
import { validateApiKey } from '@/lib/nexus';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ ok: false, message: 'API key is required.' }, { status: 400 });
    }

    const user = await validateApiKey(apiKey.trim());
    await setApiKeyCookie(apiKey.trim());

    return NextResponse.json({ ok: true, user });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || 'Could not validate Nexus API key.', details: error?.payload },
      { status: error?.status || 500 }
    );
  }
}
