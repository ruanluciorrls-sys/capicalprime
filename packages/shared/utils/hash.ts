/**
 * Utilitários de hashing para deduplicação de QR Codes
 */

/**
 * Gera SHA-256 de uma string (funciona em browser e Node.js)
 */
export async function sha256(data: string): Promise<string> {
  // Browser / Extension environment
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js environment (backend)
  const { createHash } = await import('crypto');
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Normaliza o payload Pix antes do hash (remove espaços, uppercase)
 */
export function normalizePixPayload(payload: string): string {
  return payload.trim().toUpperCase();
}

/**
 * Gera hash de deduplicação para um payload QR Code
 */
export async function hashQrPayload(payload: string): Promise<string> {
  const normalized = normalizePixPayload(payload);
  return sha256(normalized);
}
