"use strict";
/**
 * Parser do payload Pix EMV 4.0 (BACEN)
 * Extrai todos os campos do QR Code estático e dinâmico
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCRC = verifyCRC;
exports.isPix = isPix;
exports.parsePix = parsePix;
function parseTLV(payload) {
    const result = [];
    let i = 0;
    while (i < payload.length) {
        if (i + 4 > payload.length)
            break;
        const id = payload.substring(i, i + 2);
        const length = parseInt(payload.substring(i + 2, i + 4), 10);
        if (isNaN(length) || i + 4 + length > payload.length)
            break;
        const value = payload.substring(i + 4, i + 4 + length);
        result.push({ id, length, value });
        i += 4 + length;
    }
    return result;
}
function findValue(tlvs, id) {
    const found = tlvs.find(t => t.id === id);
    return found ? found.value : null;
}
/**
 * Verifica CRC16/CCITT do payload Pix
 */
function verifyCRC(payload) {
    if (payload.length < 4)
        return false;
    const data = payload.slice(0, -4);
    const expectedCRC = payload.slice(-4).toUpperCase();
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            }
            else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    const computed = crc.toString(16).toUpperCase().padStart(4, '0');
    return computed === expectedCRC;
}
/**
 * Verifica se payload é um QR Code Pix válido
 */
function isPix(payload) {
    return (payload.startsWith('000201') &&
        payload.includes('0014BR.GOV.BCB.PIX'));
}
/**
 * Extrai todos os campos de um payload Pix EMV
 */
function parsePix(payload) {
    const result = {
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
    if (!isPix(payload))
        return result;
    result.isValid = true;
    const tlvs = parseTLV(payload);
    // ID 04: Merchant Account Information (Pix)
    const merchantInfo = findValue(tlvs, '26');
    if (merchantInfo) {
        const subTlvs = parseTLV(merchantInfo);
        // ID 01: Chave Pix (estático) ou URL (dinâmico)
        const key = findValue(subTlvs, '01');
        const url = findValue(subTlvs, '25');
        if (url) {
            result.isDynamic = true;
            result.url = url;
        }
        else if (key) {
            result.pixKey = key;
        }
    }
    // ID 54: Transaction Amount
    const amount = findValue(tlvs, '54');
    if (amount) {
        result.amount = parseFloat(amount);
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
    // CRC16
    result.crc = payload.slice(-4);
    return result;
}
//# sourceMappingURL=pix-parser.js.map