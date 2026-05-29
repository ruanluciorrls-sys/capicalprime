// ──────────────────────────────────────────────────────────────
// WebSocket Event Contract (shared between backend, frontend, extension)
// ──────────────────────────────────────────────────────────────

export type WsEventType =
  | 'QR_RECEIVED'
  | 'QR_STATUS_UPDATE'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'DEVICE_CONNECTED'
  | 'DEVICE_DISCONNECTED'
  | 'ERROR';

export interface WsEvent<T = unknown> {
  event: WsEventType;
  data: T;
  timestamp: string;
  userId?: string;
}

// ── Payloads ──────────────────────────────────────────────────

export interface QrReceivedPayload {
  id: string;
  payload: string;
  amount: number | null;
  merchantName: string | null;
  merchantCity: string | null;
  pixKey: string | null;
  transactionId: string | null;
  sourceUrl: string;
  capturedAt: string;
  deviceId: string;
}

export interface QrStatusUpdatePayload {
  id: string;
  status: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface PaymentStatusPayload {
  paymentId: string;
  qrCodeId: string;
  status: string;
  amount: number;
  bankEnd2EndId?: string;
  errorMessage?: string;
  executedAt?: string;
}

export interface DeviceStatusPayload {
  deviceId: string;
  userId: string;
  connectedAt?: string;
}

// ── Extension → Backend Messages ─────────────────────────────

export interface ExtensionQrMessage {
  type: 'QR_DETECTED';
  payload: string;
  hash: string;
  sourceUrl: string;
  capturedAt: string;
}
