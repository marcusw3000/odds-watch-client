import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export type PixDestination = { receiverDocument: string; pixKeyType: 'national_registration' | 'email' | 'phone' | 'evp'; pixKey: string };

function decodeKey(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('Chave de criptografia PIX inválida.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('Chave de criptografia PIX inválida.');
  return key;
}

export function protectPixDestination(destination: PixDestination, userId: string, operationId: string, valueCents: number, secret: string) {
  const key = decodeKey(secret);
  const payload = JSON.stringify([destination.receiverDocument, destination.pixKeyType, destination.pixKey]);
  const aad = Buffer.from(`${userId}:${operationId}`);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const ciphertext = ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  const fingerprint = createHmac('sha256', key).update(JSON.stringify(['withdrawal', userId, valueCents, payload])).digest('hex');
  return { ciphertext, fingerprint };
}

export function recoverPixDestination(value: string, userId: string, operationId: string, secret: string): PixDestination {
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Destino PIX inválido.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', decodeKey(secret), Buffer.from(parts[1], 'base64url'));
    decipher.setAAD(Buffer.from(`${userId}:${operationId}`));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
    const data: unknown = JSON.parse(plaintext);
    if (!Array.isArray(data) || data.length !== 3 || !data.every(item => typeof item === 'string') || !['national_registration', 'email', 'phone', 'evp'].includes(data[1])) throw new Error('invalid');
    return { receiverDocument: data[0], pixKeyType: data[1] as PixDestination['pixKeyType'], pixKey: data[2] };
  } catch { throw new Error('Destino PIX indisponível.'); }
}
