/**
 * Utilitários de hashing para deduplicação de QR Codes
 */
/**
 * Gera SHA-256 de uma string (funciona em browser e Node.js)
 */
export declare function sha256(data: string): Promise<string>;
/**
 * Normaliza o payload Pix antes do hash (remove espaços, uppercase)
 */
export declare function normalizePixPayload(payload: string): string;
/**
 * Gera hash de deduplicação para um payload QR Code
 */
export declare function hashQrPayload(payload: string): Promise<string>;
//# sourceMappingURL=hash.d.ts.map