import { NextRequest, NextResponse } from 'next/server';

type RateEntry = { count: number; resetAt: number };

const rateBuckets = new Map<string, RateEntry>();
const GENERAL_LIMIT = 120;
const GENERAL_WINDOW_MS = 60_000;
const SENSITIVE_LIMIT = 10;
const SENSITIVE_WINDOW_MS = 10 * 60_000;
let lastRateCleanup = 0;

function clientAddress(request: NextRequest) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function rateLimit(request: NextRequest) {
  const sensitive = /^\/api\/(auth\/nexus\/(start|callback)|collections\/(import|publish))\/?$/.test(request.nextUrl.pathname);
  const limit = sensitive ? SENSITIVE_LIMIT : GENERAL_LIMIT;
  const windowMs = sensitive ? SENSITIVE_WINDOW_MS : GENERAL_WINDOW_MS;
  const now = Date.now();
  const key = `${clientAddress(request)}:${sensitive ? 'sensitive' : 'general'}`;
  const current = rateBuckets.get(key);
  const entry = !current || current.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { ...current, count: current.count + 1 };
  rateBuckets.set(key, entry);

  if (now - lastRateCleanup >= GENERAL_WINDOW_MS || rateBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    lastRateCleanup = now;
  }

  const headers = {
    'RateLimit-Limit': String(limit),
    'RateLimit-Remaining': String(Math.max(0, limit - entry.count)),
    'RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000))
  };
  if (entry.count <= limit) return { headers };
  return {
    headers,
    response: NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { ...headers, 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } }
    )
  };
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ message: 'Cross-origin request rejected.' }, { status: 403 });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    const maxBodyBytes = request.nextUrl.pathname === '/api/collections/import' ? 8 * 1024 * 1024 + 64 * 1024 : 1024 * 1024;
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxBodyBytes) {
      return NextResponse.json({ message: 'Request body is too large.' }, { status: 413 });
    }

    const limited = rateLimit(request);
    if (limited.response) return limited.response;
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(limited.headers)) response.headers.set(name, value);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm)$).*)']
};

export const runtime = 'experimental-edge';
