import crypto from 'crypto';

// AES-256-GCM encryption for sensitive secrets at rest (e.g. API keys).
//
// Storage format: base64( iv(12) || authTag(16) || ciphertext )
// Key source: API_KEY_ENCRYPTION_SECRET env var (must be 32 bytes when decoded).
//
// To generate a fresh secret:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET env var is not set');
  }
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error(`API_KEY_ENCRYPTION_SECRET must decode to 32 bytes, got ${key.length}`);
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted payload too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// Best-effort decrypt — returns null if the value is missing, malformed,
// or appears to be a plaintext key (e.g. starts with "sk-"). Used during
// the migration window when both formats may exist.
export function tryDecryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  if (payload.startsWith('sk-')) return payload; // legacy plaintext
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}
