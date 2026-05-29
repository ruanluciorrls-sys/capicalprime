"use strict";
/**
 * Utilitários de hashing para deduplicação de QR Codes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.normalizePixPayload = normalizePixPayload;
exports.hashQrPayload = hashQrPayload;
/**
 * Gera SHA-256 de uma string (funciona em browser e Node.js)
 */
async function sha256(data) {
    // Browser / Extension environment
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = Array.from(new Uint8Array(buffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Node.js environment (backend)
    const { createHash } = await Promise.resolve().then(() => __importStar(require('crypto')));
    return createHash('sha256').update(data, 'utf8').digest('hex');
}
/**
 * Normaliza o payload Pix antes do hash (remove espaços, uppercase)
 */
function normalizePixPayload(payload) {
    return payload.trim().toUpperCase();
}
/**
 * Gera hash de deduplicação para um payload QR Code
 */
async function hashQrPayload(payload) {
    const normalized = normalizePixPayload(payload);
    return sha256(normalized);
}
//# sourceMappingURL=hash.js.map