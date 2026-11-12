import crypto from 'crypto';

const ENCRYPTION_PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer {
  const rawSecret =
    process.env['DATA_ENCRYPTION_KEY'] ||
    process.env['JWT_SECRET'] ||
    'tickwork-aes-256-gcm-field-encryption-secret-key-2026';
  return crypto.createHash('sha256').update(rawSecret).digest();
}

/**
 * Encrypts a sensitive string field (such as phone number or personal ID) using AES-256-GCM.
 * Produces format: "enc:v1:<ivHex>:<authTagHex>:<cipherHex>"
 */
export function encryptField(plainText: string | null | undefined): string | null {
  if (plainText === null || plainText === undefined) return null;
  const trimmed = String(plainText).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(ENCRYPTION_PREFIX)) {
    return trimmed;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a field encrypted by encryptField().
 * Transparently returns plaintext if the value is not prefixed (backward compatibility).
 */
export function decryptField(storedValue: string | null | undefined): string | null {
  if (storedValue === null || storedValue === undefined) return null;
  const trimmed = String(storedValue).trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith(ENCRYPTION_PREFIX)) {
    return trimmed;
  }

  try {
    const payload = trimmed.slice(ENCRYPTION_PREFIX.length);
    const [ivHex, authTagHex, cipherHex] = payload.split(':');
    if (!ivHex || !authTagHex || !cipherHex) {
      return null;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Error decrypting field:', err);
    return null;
  }
}
