// service-worker.ts Ã¢â‚¬â€ Capital Prime Extension (Manifest V3)

import { io } from 'socket.io-client';
import { QrDedup } from '../lib/qr-dedup';
import { DeviceRegistry } from './device-registry';
import { QrSender } from './qr-sender';

const registry = new DeviceRegistry();
const dedup = new QrDedup();
let sender: QrSender | null = null;
let wsConnected = false;
let socket: ReturnType<typeof io> | null = null;
let initialized = false;
let connecting = false; // guard: evita criar mÃƒÂºltiplos sockets em paralelo
const USER_AGENT = String(globalThis?.navigator?.userAgent || '');
const IS_UNGOOGLED_CHROMIUM = /ungoogled-chromium/i.test(USER_AGENT);
const CONNECTION_LINE = 'Extensao > VPS > Painel';

function normalizePixText(text: string) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();
}

function isPixCandidate(text: string) {
  const clean = normalizePixText(text);
  return (
    clean.length >= 80 &&
    clean.startsWith('000201') &&
    clean.toLowerCase().includes('br.gov.bcb.pix') &&
    /6304[A-F0-9]{4}$/i.test(clean)
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ ensureInit Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// CRÃƒÂTICO para Manifest V3: o SW pode ser morto a qualquer momento.
// Quando renasce, as variÃƒÂ¡veis em memÃƒÂ³ria estÃƒÂ£o zeradas.
// ensureInit() restaura o estado a partir do storage.
async function ensureInit() {
  if (initialized && sender) return;

  await dedup.load();
  const token = await registry.getToken();
  if (token) {
    sender = new QrSender(token);
    if (!socket?.connected) {
      await connectSocket();
    }
  }
  initialized = true;
  console.log(`[EXTENSION] ensureInit concluÃƒÂ­do | sender=${sender ? 'ok' : 'null'}`);
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Status do Socket.IO Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function updateConnectionStatus(connected: boolean) {
  wsConnected = connected;
  chrome.storage.local.set({ wsConnected: connected });
  chrome.runtime.sendMessage({ type: 'WS_STATUS', connected }).catch(() => {});
}

// Ã¢â€â‚¬Ã¢â€â‚¬ ConexÃƒÂ£o Socket.IO Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function connectSocket() {
  const token = await registry.getToken();
  if (!token) return;
  if (socket?.connected) return;
  if (connecting) return; // evita corrida ao chamar connectSocket() em paralelo

  connecting = true;
  try {
    // DestrÃƒÂ³i socket anterior para nÃƒÂ£o acumular listeners
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    const wsUrl = 'http://177.153.202.47:3001';

    socket = io(wsUrl, {
      transports: IS_UNGOOGLED_CHROMIUM ? ['polling', 'websocket'] : ['websocket', 'polling'],
      auth: { token },
      query: {
        token,
        apiKey: token,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.3,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[EXTENSION] Socket.IO conectado (' + CONNECTION_LINE + ')', socket?.id);
      updateConnectionStatus(true);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('[EXTENSION] Socket.IO desconectado:', reason);
      updateConnectionStatus(false);
    });

    socket.on('connect_error', (err: Error) => {
      console.error('[EXTENSION] Socket.IO erro (' + CONNECTION_LINE + '):', err.message);
      updateConnectionStatus(false);
    });

    socket.on('QR_STATUS_UPDATE', (data: unknown) => {
      console.log('[EXTENSION] QR_STATUS_UPDATE recebido:', data);
    });
  } finally {
    connecting = false;
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ InicializaÃƒÂ§ÃƒÂ£o Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function init() {
  await ensureInit();
  await reportHeartbeat();
}

init();

// Ã¢â€â‚¬Ã¢â€â‚¬ Handlers de mensagem Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
chrome.runtime.onMessage.addListener((msg, _senderTab, sendResponse) => {

  // PIX_CODE_DETECTED/QR_DETECTED Ã¢â‚¬â€ vem do content script ao detectar QR na pÃƒÂ¡gina
  // ATENÃƒâ€¡ÃƒÆ’O: retorna `true` OBRIGATORIAMENTE para manter o canal aberto durante
  // o processamento assÃƒÂ­ncrono. Sem isso, o SW fecha antes de terminar.
  if (msg.type === 'PIX_CODE_DETECTED' || msg.type === 'QR_DETECTED') {
    console.log('[BACKGROUND] PIX_CODE_DETECTED recebido');
    ensureInit()
      .then(() => handleDetectedQr(msg.payload, msg.sourceUrl))
      .then((result) => sendResponse(result))
      .catch((err) => {
        console.error('[EXTENSION] Erro ao processar PIX_CODE_DETECTED:', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // Ã¢â€ Â CRÃƒÂTICO: mantÃƒÂ©m canal aberto para resposta assÃƒÂ­ncrona
  }

  if (msg.type === 'TEST_QR') {
    ensureInit()
      .then(() => runTestCapture())
      .then((success) => {
        console.log('[EXTENSION] Test QR enviado, resposta:', { success });
        sendResponse({ ok: success, success });
      })
      .catch((err) => {
        console.error('[EXTENSION] Erro ao enviar test QR:', err);
        sendResponse({ ok: false, success: false, error: String(err) });
      });
    return true;
  }

  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get(['wsConnected'], (res) => {
      sendResponse({ connected: res.wsConnected === true, connectionLine: CONNECTION_LINE });
    });
    return true;
  }

  return false;
});

// Ã¢â€â‚¬Ã¢â€â‚¬ LÃƒÂ³gica de captura Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function handleDetectedQr(payload: string, sourceUrl: string): Promise<{ ok: boolean; error?: string }> {
  if (!sender) {
    console.warn('[EXTENSION] Ã¢Å¡Â  QR detectado mas sender ÃƒÂ© null (nÃƒÂ£o vinculado).');
    notifyCapture('ExtensÃƒÂ£o nÃƒÂ£o vinculada. Acesse o popup e insira a API Key.', true);
    return { ok: false, error: 'not_linked' };
  }

  const cleanPayload = normalizePixText(payload);
  const isValid = isPixCandidate(cleanPayload);
  if (isValid) {
    console.log('[BACKGROUND] PadrÃ£o Pix validado');
  }

  const hash = await sha256(cleanPayload);
  console.log('[BACKGROUND] payloadHash gerado');

  if (dedup.has(hash)) {
    console.log('[BACKGROUND] Pix ignorado por duplicidade');
    return { ok: false, error: 'duplicate_local' };
  }

  if (isValid) {
    const success = await sender.send({ payload: cleanPayload, payloadHash: hash, sourceUrl });

    if (success) {
      // SÃƒÂ³ adiciona ao dedup apÃƒÂ³s confirmaÃƒÂ§ÃƒÂ£o do backend Ã¢â‚¬â€ libera slot para outro QR diferente imediatamente
      await dedup.add(hash);
      console.log('[BACKGROUND] Pix enviado ao backend');
      notifyCapture('QR capturado! Aguardando aprovaÃƒÂ§ÃƒÂ£o no dashboard.');
      await reportHeartbeat();
      return { ok: true };
    } else {
      // NÃƒÂ£o adiciona ao dedup: backend rejeitou ou estava fora, deixa o content script tentar de novo
      console.error('[EXTENSION] Ã¢ÂÅ’ Falha ao enviar QR ao backend (nÃƒÂ£o adicionado ao dedup).');
      notifyCapture('Falha ao enviar QR para o backend.', true);
      await reportHeartbeat();
      return { ok: false, error: 'ingest_failed' };
    }
  }

  const success = await sender.sendRaw({ rawContent: cleanPayload, rawHash: hash, sourceUrl });
  if (success) {
    await dedup.add(hash);
    console.log('[BACKGROUND] Captura enviada como raw-capture');
    await reportHeartbeat();
    return { ok: false, error: 'not_pix_candidate' };
  }

  await reportHeartbeat();
  return { ok: false, error: 'raw_capture_failed' };
}

async function runTestCapture() {
  if (!sender) return false;
  const ts = Date.now();
  const payload = `00020101021126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-42661417400052040000530398654040.015802BR5909AIOS TEST6008BRASILIA62070503***6304${ts.toString().slice(-4)}`;
  const hash = await sha256(`${payload}:${ts}`);
  const success = await sender.send({ payload, payloadHash: hash, sourceUrl: 'chrome-extension://test', isTest: true });
  notifyCapture(
    success ? 'Teste enviado! Verifique a fila do dashboard.' : 'Falha na conexÃƒÂ£o com o servidor.',
    !success,
  );
  await reportHeartbeat();
  return success;
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function notifyCapture(message: string, isError = false) {
  try {
    chrome.runtime.sendMessage({ type: 'QR_CAPTURED', message, level: isError ? 'error' : 'success' }).catch((err) => {
      if (!err.message?.includes('Extension context invalidated')) {
        console.error('[BACKGROUND] Erro sendMessage:', err);
      }
    });
  } catch (err: any) {
    if (!err.message?.includes('Extension context invalidated')) {
      console.error('[BACKGROUND] notifyCapture erro:', err);
    }
  }
  try {
    chrome.notifications.create(`aios-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icon.png',
      title: isError ? 'Capital Prime - Erro' : 'Capital Prime',
      message,
    });
  } catch (_) {}
}

async function reportHeartbeat() {
  if (!sender) return;
  // Reconecta socket se caiu Ã¢â‚¬â€ sem depender de health endpoint externo
  if (!socket?.connected) {
    await connectSocket();
  }
  const deviceId = await registry.getDeviceId();
  const status = sender.getLastError() ? 'ERROR' : (wsConnected ? 'ONLINE' : 'OFFLINE');
  await sender.heartbeat(deviceId, status);
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Keep-alive Manifest V3 Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Alarme a cada 30s mantÃƒÂ©m o SW ativo e reconecta se necessÃƒÂ¡rio
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepAlive') {
    await ensureInit();
    if (sender) {
      if (!socket?.connected) await connectSocket();
      await reportHeartbeat();
    }
  }
});


