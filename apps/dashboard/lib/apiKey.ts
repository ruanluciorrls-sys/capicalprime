/**
 * Auth helper — JWT (preferido) + apiKey (legado / extensão).
 *
 * Fluxo:
 *  1. Usuário faz login → backend retorna { token, user }
 *  2. setAuthToken(token, user) salva no localStorage
 *  3. authHeaders() devolve { Authorization: Bearer ... } pra cada fetch
 *  4. getApiKey() ainda existe pra compatibilidade com código antigo
 */

const DEFAULT_KEY = process.env.NEXT_PUBLIC_DEFAULT_API_KEY ?? 'AIOS_DEFAULT_KEY_2025';
const LS_KEY      = 'aios_api_key';      // legado
const LS_TOKEN    = 'cp_auth_token';     // JWT
const LS_USER     = 'cp_auth_user';      // dados do usuário logado

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'MASTER_ADMIN' | 'ADMIN' | 'USER' | 'VIEWER';
  features: string[] | null;
  apiKey: string;
  subscriptionExpiresAt: string | null;
  subscriptionDaysRemaining: number | null;
  isActive: boolean;
}

// ── Token ──────────────────────────────────────────────────────
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LS_TOKEN);
}

export function setAuthToken(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USER, JSON.stringify(user));
  // Também guarda a apiKey real do usuário (pra ser usada na extensão / fallback)
  if (user.apiKey) localStorage.setItem(LS_KEY, user.apiKey);
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
  // Não limpa LS_KEY para manter compatibilidade legada
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LS_USER);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// ── Headers para fetch ─────────────────────────────────────────
/**
 * Retorna headers de auth (Bearer se logado, senão X-Api-Key).
 * Use em todo fetch para o backend.
 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}`, ...extra };
  }
  return { 'X-Api-Key': getApiKey(), ...extra };
}

// ── Legado (mantido pra não quebrar código existente) ──────────
export function getApiKey(): string {
  if (typeof window === 'undefined') return DEFAULT_KEY;
  return localStorage.getItem(LS_KEY) || DEFAULT_KEY;
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, key.trim());
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_KEY);
}

export function isUsingDefault(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(LS_KEY);
  return !stored || stored === DEFAULT_KEY;
}
