// ──────────────────────────────────────────────────────────────
// QR Code Types
// ──────────────────────────────────────────────────────────────

export type QrStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'ERROR' | 'CANCELLED';

export interface QrCode {
  id: string;
  userId: string;
  deviceId: string | null;
  payload: string;
  payloadHash: string;
  amount: number | null;
  merchantName: string | null;
  merchantCity: string | null;
  pixKey: string | null;
  transactionId: string | null;
  sourceUrl: string;
  status: QrStatus;
  capturedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
}

export interface QrCodeSummary {
  id: string;
  amount: number | null;
  merchantName: string | null;
  pixKey: string | null;
  status: QrStatus;
  capturedAt: string;
  deviceId: string | null;
}

// ──────────────────────────────────────────────────────────────
// Payment Types
// ──────────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface Payment {
  id: string;
  qrCodeId: string;
  userId: string;
  adapterUsed: string;
  amount: number;
  status: PaymentStatus;
  bankEnd2EndId: string | null;
  bankResponse: unknown | null;
  errorMessage: string | null;
  retryCount: number;
  executedAt: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────
// User Types
// ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  createdAt: string;
}

export interface ExtensionDevice {
  id: string;
  userId: string;
  deviceId: string;
  browser: string | null;
  lastSeen: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────
// API Response Types
// ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

// ──────────────────────────────────────────────────────────────
// Stats Types
// ──────────────────────────────────────────────────────────────

export interface QrStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  paid: number;
  error: number;
  totalAmountPaid: number;
  totalAmountPending: number;
}
