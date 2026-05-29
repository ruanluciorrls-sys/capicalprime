// background.js â€” AI OS Pix Capture Extension (Manifest V3 Service Worker)
// Usa socket.io-client (ESM) â€” compatÃ­vel com NestJS Gateway Socket.IO

import { io } from './socket.io.esm.min.js';
import { CONFIG } from './config.js';

let socket = null;
let wsConnected = false;
const CONNECTION_LINE = 'Extensao > VPS > Painel';

// â”€â”€ Status do painel (HTTP heartbeat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let panelConnected = false;
let panelLastError = null;
const AUTH_ERROR_LABEL = 'token_invalido_ou_expirado';

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

// â”€â”€ Status do Socket.IO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateConnectionStatus(connected) {
  wsConnected = connected;
  chrome.storage.local.set({ wsConnected: connected });
  chrome.runtime.sendMessage({ type: 'WS_STATUS', connected }).catch(() => {});
}

// â”€â”€ Status do painel (panel HTTP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updatePanelStatus(connected, error) {
  panelConnected = connected;
  panelLastError = error || null;
  chrome.runtime.sendMessage({ type: 'PANEL_STATUS', connected, error: panelLastError }).catch(() => {});
}

function buildAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONFIG.DEVICE_TOKEN}`,
    'X-Device-Token': CONFIG.DEVICE_TOKEN,
  };
}

// â”€â”€ Heartbeat HTTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let lastHeartbeatStatus = null;
let lastHeartbeatAt = 0;
const HEARTBEAT_MIN_INTERVAL_MS = 15000; // evita flood/throttle (limite 200/min)

async function sendHeartbeat(status, error = null, force = false) {
  if (!DEVICE_ID) return;

  // Dedupe: mesmo status num intervalo curto e' ignorado (a menos que forcado)
  const now = Date.now();
  if (!force && status === lastHeartbeatStatus && (now - lastHeartbeatAt) < HEARTBEAT_MIN_INTERVAL_MS) {
    return;
  }
  lastHeartbeatStatus = status;
  lastHeartbeatAt = now;

  try {
    const response = await fetch(`${CONFIG.API_URL}/extension/heartbeat`, {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({
        deviceId: DEVICE_ID,
        status,
        error,
        version: CONFIG.VERSION || null,
      }),
    });

    if (response.ok) {
      updatePanelStatus(true, null);
    } else {
      const errData = await response.json().catch(() => ({}));
      const errMsg =
        response.status === 401 || response.status === 403
          ? AUTH_ERROR_LABEL
          : (errData?.message || `HTTP ${response.status}`);
      updatePanelStatus(false, errMsg);
    }
  } catch (e) {
    updatePanelStatus(false, e?.message || 'network_error');
  }
}

// â”€â”€ ConexÃ£o Socket.IO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function connectSocket() {
  // Guarda contra sockets duplicados: se ja existe um ativo/conectando, nao cria outro
  if (socket && (socket.connected || socket.active)) {
    return;
  }
  if (socket) {
    try { socket.removeAllListeners(); socket.disconnect(); } catch {}
    socket = null;
  }

  socket = io(CONFIG.WS_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: CONFIG.DEVICE_TOKEN },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.3,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log(`[EXTENSION] Socket.IO conectado (${CONNECTION_LINE})`, socket.id);
    updateConnectionStatus(true);
    sendHeartbeat('ONLINE', null, true);
  });

  socket.on('disconnect', (reason) => {
    console.log('[EXTENSION] Socket.IO desconectado:', reason);
    updateConnectionStatus(false);
    sendHeartbeat('OFFLINE', reason || null, true);
  });

  socket.on('connect_error', (err) => {
    console.error(`[EXTENSION] Socket.IO erro (${CONNECTION_LINE}):`, err.message);
    updateConnectionStatus(false);
    sendHeartbeat('ERROR', err?.message || 'connect_error', true);
  });

  socket.on('QR_STATUS_UPDATE', (data) => {
    console.log('[EXTENSION] QR_STATUS_UPDATE recebido:', data);
  });

  socket.on('ping', (data) => {
    if (data?.deviceId) {
      socket.emit('pong', { deviceId: data.deviceId });
    }
  });
}

// Garante um socket ativo (idempotente) â€” usado por alarm e ciclo de vida
function ensureSocket() {
  if (!socket) {
    connectSocket();
  } else if (!socket.connected) {
    socket.connect();
  }
}

connectSocket();

// Reconecta quando o Chrome inicia ou a extensÃ£o Ã© (re)instalada/atualizada
chrome.runtime.onStartup.addListener(() => ensureSocket());
chrome.runtime.onInstalled.addListener(() => ensureSocket());

// â”€â”€ Cache local de hashes enviados (10 min) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const sentHashes = new Map();

// â”€â”€ ValidaÃ§Ã£o de PIX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function normalizePixPayload(text) {
  if (!text) return '';
  return String(text).replace(/\s+/g, '').trim();
}

function isValidPixPayload(payload) {
  if (!payload) return false;
  const clean = normalizePixPayload(payload);
  if (clean.length < 80) return false;
  if (!clean.startsWith('000201')) return false;
  if (!clean.toLowerCase().includes('br.gov.bcb.pix')) return false;
  return /6304[0-9a-fA-F]{4}$/.test(clean);
}

// â”€â”€ SHA-256 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// â”€â”€ Envio de QR via HTTP (/qr/ingest) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendQr(payload, metadata = {}) {
  const payloadHash = await sha256(payload);

  const response = await fetch(`${CONFIG.API_URL}/qr/ingest`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      payload,
      payloadHash,
      sourceUrl: metadata?.sourceUrl || 'chrome-extension://scanner',
      capturedAt: metadata?.capturedAt || new Date().toISOString(),
      isTest: !!metadata?.isTest
    })
  });

  if (response.status === 409) {
    console.log('[EXTENSION] QR duplicado (409) - ignorado');
    return { ok: true, duplicate: true };
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('auth_block_cooldown');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    const errMsg = errData?.message || `HTTP ${response.status}`;
    throw new Error(`HTTP ${response.status}: ${errMsg}`);
  }

  return response.json().catch(() => ({ ok: true }));
}

// â”€â”€ Payload de teste â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getUniqueTestPayload() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `00020101021226580014BR.GOV.BCB.PIX0136${rand}-${ts}52040000530398654040.015802BR5909AIOS TEST6008BRASILIA62070503***6304CAFE`;
}

// â”€â”€ Keep-alive do Service Worker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// O Chrome encerra o Service Worker (MV3) apos ~30s ocioso. O alarm o acorda,
// reconecta o socket (idempotente) e atualiza o heartbeat no painel.
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'keepAlive') return;
  fetch(`${CONFIG.API_URL}/health`).catch(() => {});
  ensureSocket();
  sendHeartbeat(socket && socket.connected ? 'ONLINE' : 'OFFLINE');
});

// â”€â”€ Message handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // GET_STATUS: retorna estado completo para o popup
  if (msg.type === 'GET_STATUS') {
    sendResponse({
      connected: wsConnected,
      panelConnected,
      panelLastError,
      deviceId: DEVICE_ID,
      apiUrlCandidates: [CONFIG.API_URL],
      connectionLine: CONNECTION_LINE,
    });
    return false;
  }

  // TEST_PANEL_CONNECTION: testa heartbeat com o backend VPS
  if (msg.type === 'TEST_PANEL_CONNECTION') {
    (async () => {
      try {
        if (!DEVICE_ID) {
          sendResponse({ ok: false, error: 'device_id_ausente' });
          return;
        }
        const response = await fetch(`${CONFIG.API_URL}/extension/heartbeat`, {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            deviceId: DEVICE_ID,
            status: 'ONLINE',
            version: CONFIG.VERSION || null,
          }),
        });

        if (response.ok) {
          updatePanelStatus(true, null);
          sendResponse({ ok: true });
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg =
            response.status === 401 || response.status === 403
              ? AUTH_ERROR_LABEL
              : (errData?.message || `HTTP ${response.status}`);
          updatePanelStatus(false, errMsg);
          sendResponse({ ok: false, error: errMsg });
        }
      } catch (e) {
        const errMsg = e?.message || 'network_error';
        updatePanelStatus(false, errMsg);
        sendResponse({ ok: false, error: errMsg });
      }
    })();
    return true;
  }

  // QR_DETECTED: captura via popup/injeÃ§Ã£o
  if (msg.type === 'QR_DETECTED') {
    sendQr(msg.payload, { sourceUrl: msg.sourceUrl })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // TEST_QR: envia QR de teste ao backend
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
        if (String(err?.message || '').includes('auth_block_cooldown')) {
          await sendHeartbeat('ERROR', AUTH_ERROR_LABEL, true);
          sendResponse({ ok: false, error: 'auth_block_cooldown' });
          return;
        }
        console.error('[BACKGROUND] Resposta do backend: erro -', err.message);
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true;
  }

  // RAW_QR_CAPTURED: captura bruta (campos alinhados ao RawQrCaptureDto)
  if (msg.type === 'RAW_QR_CAPTURED') {
    const { rawContent, metadata } = msg;

    (async () => {
      try {
        if (!rawContent) throw new Error('ConteÃºdo bruto vazio');

        const rawHash = await sha256(rawContent);
        const now = Date.now();

        for (const [h, timestamp] of sentHashes.entries()) {
          if (now - timestamp > 10 * 60 * 1000) sentHashes.delete(h);
        }

        if (sentHashes.has(rawHash)) {
          console.log('[BACKGROUND] Captura repetida ignorada.');
          sendResponse({ ok: false, error: 'duplicate_local' });
          return;
        }

        // Apenas campos presentes no RawQrCaptureDto (forbidNonWhitelisted=true no backend)
        const payloadToSend = {
          rawContent,
          rawHash,
          sourceUrl: metadata?.sourceUrl || 'chrome-extension://scanner',
          pageTitle: metadata?.pageTitle || '',
          captureMethod: metadata?.captureMethod || 'unknown',
          capturedAt: metadata?.capturedAt || new Date().toISOString(),
        };

        console.log('[BACKGROUND] Payload raw enviado ao painel:', JSON.stringify(payloadToSend));

        const response = await fetch(`${CONFIG.API_URL}/qr/raw-capture`, {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify(payloadToSend)
        });

        if (response.status === 409) {
          sentHashes.set(rawHash, Date.now());
          console.log('[BACKGROUND] Duplicata no backend (409) â€” ignorado');
          sendResponse({ ok: false, error: 'duplicate_global' });
          return;
        }

        if (response.status === 401 || response.status === 403) {
          await sendHeartbeat('ERROR', AUTH_ERROR_LABEL, true);
          sendResponse({ ok: false, error: 'auth_block_cooldown' });
          return;
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const errMsg = errData?.message || `HTTP ${response.status}`;
          throw new Error(`HTTP ${response.status}: ${errMsg}`);
        }

        const responseData = await response.json().catch(() => ({}));
        sentHashes.set(rawHash, Date.now());
        console.log('[BACKGROUND] Resposta do painel:', responseData);
        sendResponse({ ok: true });

      } catch (err) {
        console.error('[BACKGROUND] Erro ao enviar QR Code para o painel:', err.message);
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true;
  }
});

