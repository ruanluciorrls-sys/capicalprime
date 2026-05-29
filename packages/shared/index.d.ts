export type { QrStatus, QrCode, QrCodeSummary, PaymentStatus, Payment, User, ExtensionDevice, ApiResponse, PaginatedResponse, ApiError, QrStats } from './types/qr.types';
export type { WsEventType, WsEvent, QrReceivedPayload, QrStatusUpdatePayload, PaymentStatusPayload, DeviceStatusPayload, ExtensionQrMessage } from './types/ws-events.types';
export { verifyCRC, isPix, parsePix } from './utils/pix-parser';
export type { PixPayload } from './utils/pix-parser';
export { sha256, normalizePixPayload, hashQrPayload } from './utils/hash';
//# sourceMappingURL=index.d.ts.map