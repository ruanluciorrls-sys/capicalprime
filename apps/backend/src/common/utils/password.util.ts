import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Password hashing utility usando scrypt do Node nativo.
 * Formato armazenado: scrypt$<salt-hex>$<hash-hex>
 *
 * Por que scrypt e não bcrypt:
 * - bcrypt requer compilação nativa (problemas no Windows)
 * - scrypt está no Node core, sem dependências extras
 * - segurança equivalente (resistente a hardware customizado)
 */
const KEYLEN = 64;
const SALT_LEN = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
