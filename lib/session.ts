import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'nexus_key';

function getSecret(): Buffer {
  const raw = process.env.NEXUS_SESSION_SECRET || 'dev-secret-change-me-change-me-32-chars';
  return crypto.createHash('sha256').update(raw).digest();
}

export function sealApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function unsealApiKey(value: string): string | null {
  try {
    const data = Buffer.from(value, 'base64url');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getSecret(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export async function setApiKeyCookie(apiKey: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sealApiKey(apiKey), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  });
}

export async function clearApiKeyCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getApiKeyFromCookie(): Promise<string | null> {
  const store = await cookies();
  const sealed = store.get(COOKIE_NAME)?.value;
  if (!sealed) return null;
  return unsealApiKey(sealed);
}
