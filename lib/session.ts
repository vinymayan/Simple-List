import crypto from 'node:crypto';

function getSecret(): Buffer {
  const raw = process.env.NEXUS_SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error('NEXUS_SESSION_SECRET must be configured with at least 32 characters.');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function sealSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function unsealSecret(value: string): string | null {
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
