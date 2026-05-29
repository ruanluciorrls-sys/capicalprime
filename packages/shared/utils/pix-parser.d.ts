/**
 * Parser do payload Pix EMV 4.0 (BACEN)
 * Extrai todos os campos do QR Code estático e dinâmico
 */
export interface PixPayload {
    isValid: boolean;
    isDynamic: boolean;
    amount: number | null;
    merchantName: string | null;
    merchantCity: string | null;
    pixKey: string | null;
    transactionId: string | null;
    description: string | null;
    url: string | null;
    crc: string | null;
}
/**
 * Verifica CRC16/CCITT do payload Pix
 */
export declare function verifyCRC(payload: string): boolean;
/**
 * Verifica se payload é um QR Code Pix válido
 */
export declare function isPix(payload: string): boolean;
/**
 * Extrai todos os campos de um payload Pix EMV
 */
export declare function parsePix(payload: string): PixPayload;
//# sourceMappingURL=pix-parser.d.ts.map