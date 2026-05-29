// background.js â€” AI OS Pix Capture Extension (Manifest V3 Service Worker)
// Usa socket.io-client (ESM) â€” compatÃ­vel com NestJS Gateway Socket.IO

import { io } from './socket.io.esm.min.js';
import { CONFIG } from './config.js';

let socket = null;
let wsConnected = false;
let panelConnected = false;
let panelLastError = null;
let panelLastSuccessAt = null;
let authBlockedUntil = 0;
let socketCandidateIndex = 0;
let reconnectTimer = null;
const USER_AGENT = String(globalThis?.navigator?.userAgent || '');
const IS_UNGOOGLED_CHROMIUM = /ungoogled-chromium/i.test(USER_AGENT);
const DEVICE_ID = (() => {
  try {
    const payloadPart = String(CONFIG.DEVICE_TOKEN || '').split('.')[1] || '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const parsed = JSON.parse(json);
    return parsed?.deviceId || null;
  } catch {
    return null;
  }
})();

function getApiUrlCandidates() {
  const primary = String(CONFIG.API_URL || '').replace(/\/+$/, '');
  const candidates = [primary];

  // Fallback: se API principal for backend:3001/api/v1, tenta proxy do painel:3000/api
  if (/:\d+\/api\/v1$/i.test(primary)) {
    candidates.push(primary.replace(/:3001\/api\/v1$/i, ':3000/api'));
  } else if (/\/api\/v1$/i.test(primary)) {
    candidates.push(primary.replace(/\/api\/v1$/i, '/api'));
  }

  // MantÃ©m Ãºnicos e vÃ¡lidos
  return [...new Set(candidates.filter(Boolean))];
}

function getWsUrlCandidates() {
  const primary = String(CONFIG.WS_URL || '').replace(/\/+$/, '');
  const fromApi = getApiUrlCandidates().map((apiUrl) =>
    String(apiUrl).replace(/\/api\/v1$/i, '').replace(/\/api$/i, '')
  );
  const seed = [primary, ...fromApi].filter(Boolean);
  const expanded = [...seed];

  // Fallback entre porta backend e porta painel/proxy.
  for (const url of seed) {
    if (/:3001$/i.test(url)) expanded.push(url.replace(/:3001$/i, ':3000'));
    if (/:3000$/i.test(url)) expanded.push(url.replace(/:3000$/i, ':3001'));
  }

  return [...new Set(expanded)];
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(reason = 'unknown', useNextCandidate = false, delayMs = 2500) {
  const candidates = getWsUrlCandidates();
  if (useNextCandidate && candidates.length > 1) {
    socketCandidateIndex = (socketCandidateIndex + 1) % candidates.length;
  }

  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delayMs);
  console.warn('[EXTENSION] Reconnect agendado:', reason, '| delayMs:', delayMs, '| candidateIndex:', socketCandidateIndex);
}

async function postWithFallback(path, body) {
  const now = Date.now();
  if (authBlockedUntil > now) {
    updatePanelStatus(false, 'auth_block_cooldown');
    throw new Error('auth_block_cooldown');
  }

  const candidates = getApiUrlCandidates();
  let lastError = 'no_candidate';

  for (const baseUrl of candidates) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.DEVICE_TOKEN}`,
          'X-Device-Token': CONFIG.DEVICE_TOKEN,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401 || response.status === 403) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      if (response.ok || response.status === 409) {
        updatePanelStatus(true, null);
      } else {
        updatePanelStatus(false, `HTTP ${response.status}`);
      }
      return { response, url };
    } catch (err) {
      lastError = err?.message || 'network_error';
    }
  }

  // Bloqueio curto para evitar spam de tentativas quando token/rota estÃ¡ bloqueada
  if (/HTTP 401|HTTP 403/.test(lastError)) {
    authBlockedUntil = Date.now() + (2 * 60 * 1000);
  }
  updatePanelStatus(false, lastError);
  throw new Error(lastError);
}

// â”€â”€ Status do Socket.IO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateConnectionStatus(connected) {
  wsConnected = connected;
  chrome.storage.local.set({ wsConnected: connected });
  // Notifica o popup (falha silenciosamente se nÃ£o estiver aberto)
  chrome.runtime.sendMessage({ type: 'WS_STATUS', connected }).catch(() => {});
}

function updatePanelStatus(connected, error = null) {
  panelConnected = connected;
  panelLastError = error || null;
  if (connected) panelLastSuccessAt = new Date().toISOString();

  chrome.storage.local.set({
    panelConnected,
    panelLastError,
    panelLastSuccessAt,
  });
  chrome.runtime.sendMessage({
    type: 'PANEL_STATUS',
    connected: panelConnected,
    error: panelLastError,
    lastSuccessAt: panelLastSuccessAt,
  }).catch(() => {});
}

async function testPanelConnection() {
  if (!DEVICE_ID) throw new Error('device_id_unavailable');
  const { response, url } = await postWithFallback('/extension/heartbeat', {
    deviceId: DEVICE_ID,
    status: 'ONLINE',
    error: null,
    version: CONFIG.VERSION || null,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  return { ok: true, url };
}
async function sendHeartbeat(status, error = null) {
  if (!DEVICE_ID) return;
  try {
    await postWithFallback('/extension/heartbeat', {
      deviceId: DEVICE_ID,
      status,
      error,
      version: CONFIG.VERSION || null,
    });
  } catch {
    // heartbeat falho nao deve quebrar o worker
  }
}

// â”€â”€ ConexÃ£o Socket.IO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CONFIG.WS_URL = http://localhost:3001 (sem /api/v1)
// O socket.io-client cuida do upgrade HTTP â†’ WebSocket automaticamente.
function connectSocket() {
  const candidates = getWsUrlCandidates();
  const targetWsUrl = candidates[socketCandidateIndex % Math.max(candidates.length, 1)];
  if (!targetWsUrl) {
    console.error('[EXTENSION] Nenhuma WS_URL candidata disponivel.');
    updateConnectionStatus(false);
    scheduleReconnect('no_ws_candidate', true, 4000);
    return;
  }

  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      // noop
    }
  }

  // Em ungoogled-chromium, polling-first costuma ser mais estÃ¡vel.
  const transports = IS_UNGOOGLED_CHROMIUM ? ['polling', 'websocket'] : ['websocket', 'polling'];
  console.log('[EXTENSION] Conectando Socket.IO:', targetWsUrl, '| uaMode:', IS_UNGOOGLED_CHROMIUM ? 'ungoogled' : 'default');

  socket = io(targetWsUrl, {
    transports,
    upgrade: true,
    rememberUpgrade: false,
    forceNew: true,
    path: '/socket.io',
    auth: { token: CONFIG.DEVICE_TOKEN },
    // Fallback de compatibilidade: alguns navegadores customizados
    // nÃ£o propagam `auth` corretamente no handshake.
    query: {
      token: CONFIG.DEVICE_TOKEN,
      apiKey: CONFIG.DEVICE_TOKEN,
    },
    reconnection: false,
    timeout: 15000,
  });

  socket.on('connect', () => {
    console.log('[EXTENSION] Socket.IO conectado', socket.id);
    clearReconnectTimer();
    updateConnectionStatus(true);
    sendHeartbeat('ONLINE');
  });

  socket.on('disconnect', (reason) => {
    console.log('[EXTENSION] Socket.IO desconectado:', reason);
    updateConnectionStatus(false);
    sendHeartbeat('OFFLINE', reason || null);
    scheduleReconnect(`disconnect:${reason || 'unknown'}`, false, 3000);
  });

  socket.on('connect_error', (err) => {
    console.error('[EXTENSION] Socket.IO erro:', err.message);
    updateConnectionStatus(false);
    sendHeartbeat('ERROR', err?.message || 'connect_error');
    scheduleReconnect(`connect_error:${err?.message || 'unknown'}`, true, 2500);
  });

  // Eventos vindos do backend (ex: confirmaÃ§Ã£o de aprovaÃ§Ã£o)
  socket.on('QR_STATUS_UPDATE', (data) => {
    console.log('[EXTENSION] QR_STATUS_UPDATE recebido:', data);
  });

  // Responde a testes de ping do painel
  socket.on('ping', (data) => {
    if (data?.deviceId) {
      socket.emit('pong', { deviceId: data.deviceId });
    }
  });
}

connectSocket();

// â”€â”€ Cache local de hashes enviados (evita reenvio por 10 min) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Separado do dedup global do backend (que Ã© permanente).
// Aqui Ã© apenas para nÃ£o fazer spam enquanto o scanner roda a cada 5s.
const sentHashes = new Map();

// â”€â”€ FunÃ§Ãµes de ValidaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function normalizePixPayload(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, '')
    .replace(/\u200B|\u200C|\u200D/g, '') // zero-width spaces
    .trim();
}

function isValidPixPayload(payload) {
  if (!payload) return false;
  const clean = normalizePixPayload(payload);
  if (clean.length < 80) return false;
  if (!clean.startsWith('000201')) return false;
  if (!clean.toLowerCase().includes('br.gov.bcb.pix')) return false;

  // ValidaÃ§Ã£o universal do campo CRC16: "6304" + 4 caracteres hexadecimais no final do cÃ³digo
  const crcMatch = /6304[0-9a-fA-F]{4}$/.test(clean);
  if (!crcMatch) return false;

  return true;
}

// â”€â”€ SHA-256 via Web Crypto API (retorna hex de 64 chars) â”€â”€â”€â”€
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// â”€â”€ Envio de QR via fetch HTTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// O envio usa fetch (HTTP), nÃ£o o socket â€” o socket Ã© apenas para receber eventos.
// CONFIG.API_URL = http://localhost:3001/api/v1
async function sendQr(payload, metadata = {}) {
  // Calcular hash SHA-256 do payload (obrigatÃ³rio pelo backend: exatamente 64 chars)
  const payloadHash = await sha256(payload);
  console.log('[EXTENSION] payloadHash gerado:', payloadHash, 'tamanho:', payloadHash.length);

  const { response, url } = await postWithFallback('/qr/ingest', {
    payload,
    payloadHash,
    sourceUrl: metadata.sourceUrl || 'chrome-extension://scanner',
    capturedAt: metadata.capturedAt || new Date().toISOString(),
    isTest: !!metadata.isTest
  });
  console.log('[EXTENSION] /qr/ingest via:', url);

  // 409 = jÃ¡ recebido pelo servidor â€” tratar como sucesso silencioso
  if (response.status === 409) {
    console.log('[EXTENSION] QR duplicado (409) â€” ignorado');
    return { ok: true, duplicate: true };
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  return response.json().catch(() => ({ ok: true }));
}

// â”€â”€ Payload de teste Ãºnico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getUniqueTestPayload() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `00020101021226580014BR.GOV.BCB.PIX0136${rand}-${ts}52040000530398654040.015802BR5909AIOS TEST6008BRASILIA62070503***6304CAFE`;
}

// â”€â”€ Keep-alive (evita que o Service Worker duerma) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => {
  // Ping leve para manter o SW ativo
  for (const apiBase of getApiUrlCandidates()) {
    fetch(`${apiBase}/health`).then(() => {}).catch(() => {});
  }
  sendHeartbeat(socket && socket.connected ? 'ONLINE' : 'OFFLINE');
  // Reconecta se o socket foi perdido
  if (socket && !socket.connected) {
    scheduleReconnect('keepalive', true, 1200);
  }
});

// â”€â”€ Message handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'QR_DETECTED') {
    sendQr(msg.payload, msg.sourceUrl, false)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // resposta assÃ­ncrona
  }

  if (msg.type === 'TEST_QR') {
    const payload = getUniqueTestPayload();
    sendQr(payload, { sourceUrl: 'chrome-extension://test', isTest: true })
      .then(result => {
        console.log('[TEST] QR fake enviado com sucesso, resposta:', result);
        sendResponse({ ok: true, result });
      })
      .catch(err => {
        console.error('[EXTENSION] Erro ao enviar test QR:', err.message);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // resposta assÃ­ncrona
  }

  if (msg.type === 'GET_STATUS') {
    // Responde imediatamente com o estado em memÃ³ria (sÃ­ncrono, sem delay de storage).
    // Se o SW acabou de acordar, wsConnected = false mas o socket.on('connect')
    // vai disparar WS_STATUS assim que reconectar, atualizando o popup.
    sendResponse({
      connected: wsConnected,
      panelConnected,
      panelLastError,
      panelLastSuccessAt,
    });
    return false; // sÃ­ncrono â€” sem return true aqui
  }

  if (msg.type === 'TEST_PANEL_CONNECTION') {
    testPanelConnection()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // PIX_CODE_DETECTED: captura oficial do content script
if (msg.type === 'PIX_CODE_DETECTED') {
    console.log('[BACKGROUND] Mensagem recebida:', msg.type);
    const { payload, metadata } = msg;

    (async () => {
      try {
        if (!payload) throw new Error('Payload vazio');

        const hash = await sha256(payload);
        const now = Date.now();

        // Limpeza de cache local (10 min) para hash nÃ£o persistir infinitamente na RAM
        for (const [h, timestamp] of sentHashes.entries()) {
          if (now - timestamp > 10 * 60 * 1000) sentHashes.delete(h);
        }

        if (sentHashes.has(hash)) {
          console.log('[BACKGROUND] Hash jÃ¡ enviado, ignorando duplicata.');
          sendResponse({ ok: false, error: 'duplicate_local' });
          return;
        }

        console.log('[BACKGROUND] QR_CODE_CAPTURED recebido, encaminhando para /ingest.');
        const result = await sendQr(payload, metadata || {});
        
        if (result && result.duplicate) {
          sentHashes.set(hash, Date.now());
          sendResponse({ ok: false, error: 'duplicate_global' });
          return;
        }

        sentHashes.set(hash, Date.now());
        console.log('[BACKGROUND] Resposta do backend: sucesso.');
        sendResponse({ ok: true });

      } catch (err) {
        console.error('[BACKGROUND] Resposta do backend: erro -', err.message);
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true; // resposta assÃ­ncrona
  }

  // â”€â”€ RAW_QR_CAPTURED: captura bruta (sem validaÃ§Ã£o estrita) â”€â”€â”€â”€â”€â”€â”€â”€
  if (msg.type === 'RAW_QR_CAPTURED') {
    const { rawContent, metadata } = msg;

    (async () => {
      try {
        if (!rawContent) throw new Error('ConteÃºdo bruto vazio');

        const rawHash = await sha256(rawContent);
        const now = Date.now();

        // Limpeza de cache local (10 min) para hash nÃ£o persistir infinitamente na RAM
        for (const [h, timestamp] of sentHashes.entries()) {
          if (now - timestamp > 10 * 60 * 1000) sentHashes.delete(h);
        }

        if (sentHashes.has(rawHash)) {
          console.log('[BACKGROUND] Captura repetida ignorada.');
          sendResponse({ ok: false, error: 'duplicate_local' });
          return;
        }

        const payloadToSend = {
          rawContent: rawContent,
          rawHash: rawHash,
          sourceUrl: metadata?.sourceUrl || 'chrome-extension://scanner',
          pageTitle: metadata?.pageTitle || '',
          captureMethod: metadata?.captureMethod || 'unknown',
          capturedAt: metadata?.capturedAt || new Date().toISOString(),
          
          // User expected custom payload format
          type: "qr_code_captured",
          qrCode: rawContent,
          source: "extension",
          timestamp: metadata?.capturedAt || new Date().toISOString(),
          orderId: null,
          amount: null
        };

        console.log('[BACKGROUND] Payload enviado ao painel:', JSON.stringify(payloadToSend, null, 2));

        const post = await postWithFallback('/qr/raw-capture', payloadToSend);
        const response = post.response;

        // 409 = backend ja tem
        if (response.status === 409) {
          sentHashes.set(rawHash, Date.now());
          console.log(`[BACKGROUND] Resposta do painel: { status: 409, message: "Duplicate on backend" }`);
          sendResponse({ ok: false, error: 'duplicate_global' });
          return;
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Backend respondeu HTTP ${response.status}: ${errText}`);
        }

        const responseData = await response.json().catch(() => ({}));
        sentHashes.set(rawHash, Date.now());

        console.log(`[BACKGROUND] Resposta do painel: { status: ${response.status}, body: ${JSON.stringify(responseData)} }`);
        sendResponse({ ok: true });

      } catch (err) {
        console.error('[BACKGROUND] Erro ao enviar QR Code para o painel:', err.message);
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true; // resposta assÃ­ncrona
  }
});

