/**
 * Parser do payload Pix EMV 4.0 (BACEN)
 * Extrai todos os campos do QR Code estÃ¡tico e dinÃ¢mico
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
  url: string | null; // Para Pix dinÃ¢mico
  crc: string | null;
}

interface TLV {
  id: string;
  length: number;
  value: string;
}
/**
 * Normaliza entrada Pix sem alterar conteúdo EMV.
 * Remove apenas zero-width chars, quebra de linha e tabs.
 */
export function normalizePixInput(payload: string): string {
  return String(payload || '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();
}

function parseTLV(payload: string): TLV[] {
  const result: TLV[] = [];
  let i = 0;

  while (i < payload.length) {
    if (i + 4 > payload.length) break;
    const id = payload.substring(i, i + 2);
    const length = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(length) || i + 4 + length > payload.length) break;
    const value = payload.substring(i + 4, i + 4 + length);
    result.push({ id, length, value });
    i += 4 + length;
  }

  return result;
}

function findValue(tlvs: TLV[], id: string): string | null {
  const found = tlvs.find(t => t.id === id);
  return found ? found.value : null;
}

/**
 * Verifica CRC16/CCITT do payload Pix
 */
export function verifyCRC(payload: string): boolean {
  if (payload.length < 4) return false;
  const data = payload.slice(0, -4);
  const expectedCRC = payload.slice(-4).toUpperCase();

  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }

  const computed = crc.toString(16).toUpperCase().padStart(4, '0');
  return computed === expectedCRC;
}

export function isPix(payload: string): boolean {
  if (!payload) return false;
  const clean = normalizePixInput(payload);
  if (!clean.startsWith('000201')) return false;

  // GUI Pix obrigatoria no bloco de merchant account information.
  if (!clean.toUpperCase().includes('BR.GOV.BCB.PIX')) return false;

  // Sufixo CRC obrigatorio: ID 63 + tamanho 04 + 4 hexa.
  if (!/6304[0-9A-Fa-f]{4}$/.test(clean)) return false;

  // Trava principal de integridade: CRC16 precisa bater.
  if (!verifyCRC(clean)) return false;

  // Reforco opcional (nao bloqueante): 5802BR indica pais BR.
  // Nao vira trava principal para evitar falso-negativo em payloads fora do padrao mais comum.
  return true;
}

/**
 * Extrai todos os campos de um payload Pix EMV
 */
export function parsePix(payload: string): PixPayload {
  const result: PixPayload = {
    isValid: false,
    isDynamic: false,
    amount: null,
    merchantName: null,
    merchantCity: null,
    pixKey: null,
    transactionId: null,
    description: null,
    url: null,
    crc: null,
  };

  if (!isPix(payload)) return result;
  result.isValid = true;

  // Limpar o payload antes de parsear TLV â€” CRÃTICO:
  // isPix() jÃ¡ limpa internamente para a verificaÃ§Ã£o, mas parseTLV precisa
  // do payload limpo (sem espaÃ§os/chars invisÃ­veis) para calcular os offsets corretamente.
  const clean = normalizePixInput(payload);

  const tlvs = parseTLV(clean);

  // ID 26: Merchant Account Information (Pix)
  const merchantInfo = findValue(tlvs, '26');
  if (merchantInfo) {
    const subTlvs = parseTLV(merchantInfo);
    // Sub-tag 01: Chave Pix (estÃ¡tico) ou Sub-tag 25: URL (dinÃ¢mico)
    const key = findValue(subTlvs, '01');
    const url = findValue(subTlvs, '25');

    if (url) {
      result.isDynamic = true;
      result.url = url;
    } else if (key) {
      result.pixKey = key;
    }
  }

  // ID 54: Transaction Amount (presente apenas em PIX estÃ¡tico com valor fixo)
  const amount = findValue(tlvs, '54');
  if (amount) {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed) && parsed > 0) {
      result.amount = parsed;
    }
  }

  // ID 59: Merchant Name
  result.merchantName = findValue(tlvs, '59');

  // ID 60: Merchant City
  result.merchantCity = findValue(tlvs, '60');

  // ID 62: Additional Data Field Template
  const additionalData = findValue(tlvs, '62');
  if (additionalData) {
    const subTlvs = parseTLV(additionalData);
    // ID 05: Reference Label (txid)
    result.transactionId = findValue(subTlvs, '05');
    // ID 02: Bill Number / Description
    result.description = findValue(subTlvs, '02');
  }

  // CRC16 â€” Ãºltimos 4 chars do payload limpo
  result.crc = clean.slice(-4);

  return result;
}

