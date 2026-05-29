const API_URL = 'http://localhost:3001/api/v1';
const WS_URL = 'http://localhost:3001';
const EXT_VERSION = '2.2.3';
const DEVICE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NzZmMzU0Zi00MjE5LTRhMWUtOGFlNi00MTJiMjVlNWJjMjEiLCJkZXZpY2VJZCI6ImQzYTNiZGVmLTMyMGYtNGIyOS04NjAzLWJkZTczNGRkMDA0YSIsImlhdCI6MTc3OTk5ODUyOCwiZXhwIjoxODExNTM0NTI4fQ.CP84jpcBcn6cfuQOJsPSPZjEOKOfD32G_5r1H_FnUBE';
const DEVICE_ID = (() => {
  try {
    const payloadPart = DEVICE_TOKEN.split('.')[1] || '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const parsed = JSON.parse(json);
    return parsed.deviceId || `chrome-${crypto.randomUUID()}`;
  } catch {
    return `chrome-${crypto.randomUUID()}`;
  }
})();

let ws = null;

function ensureKeepAliveAlarm() {
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
}

function connectWebSocket() {
  if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
  const socketUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&apiKey=${encodeURIComponent(DEVICE_TOKEN)}`;
  ws = new WebSocket(socketUrl);
  ws.onopen = () => {
    console.log('[AIOS] WebSocket connected.');
    chrome.storage.local.set({ wsStatus: 'connected' });
    sendHeartbeat('ONLINE', null);
  };
  ws.onmessage = (event) => { if (event.data === '2') ws.send('3'); };
  ws.onclose = () => {
    console.log('[AIOS] WebSocket disconnected. Reconnecting...');
    chrome.storage.local.set({ wsStatus: 'disconnected' });
    sendHeartbeat('OFFLINE', null);
    setTimeout(connectWebSocket, 5000);
  };
  ws.onerror = (e) => console.error('[AIOS] WebSocket error.', e);
}

async function sendHeartbeat(status, error) {
  try {
    await fetch(`${API_URL}/extension/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEVICE_TOKEN}` },
      body: JSON.stringify({ deviceId: DEVICE_ID, status, error: error || null, version: EXT_VERSION }),
    });
  } catch (err) {}
}

async function sendQrToBackend(payload, payloadHash, sourceUrl, isTest, callback) {
  try {
    const res = await fetch(`${API_URL}/qr/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEVICE_TOKEN}` },
      body: JSON.stringify({ payload, payloadHash, sourceUrl, capturedAt: new Date().toISOString(), isTest: !!isTest }),
    });
    const data = await res.json();
    if (res.ok) {
      const message = isTest ? 'Teste enviado! Verifique o dashboard.' : 'Pix capturado!';
      chrome.notifications.create('', { type: 'basic', iconUrl: '', title: 'Pix Capturado!', message });
      if (callback) callback({ success: true, message });
    } else if (res.status === 409) {
      if (callback) callback({ success: false, message: 'QR duplicado.' });
    } else {
      if (callback) callback({ success: false, message: data.message || 'Erro' });
    }
  } catch (err) {
    if (callback) callback({ success: false, message: 'Falha na conexão.' });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'QR_DETECTED') {
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg.payload)).then(hash => {
      const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
      sendQrToBackend(msg.payload, hashHex, msg.sourceUrl, false, null);
    });
    return false;
  }
  if (msg.type === 'TEST_QR') {
    const ts = Date.now();
    const testPayload = `00020126580014BR.GOV.BCB.PIX0136test-${ts}52040000530398654040.015802BR5912TESTE6009SAOPAULO62070503***6304ABCD`;
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(testPayload+ts)).then(hash => {
      const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
      sendQrToBackend(testPayload, hashHex, 'chrome-extension://test', true, sendResponse);
    });
    return true;
  }
  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get('wsStatus', (data) => sendResponse({ status: data.wsStatus || 'disconnected' }));
    return true;
  }
  return false;
});

chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
ensureKeepAliveAlarm();
chrome.runtime.onStartup.addListener(ensureKeepAliveAlarm);
chrome.runtime.onInstalled.addListener(ensureKeepAliveAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    sendHeartbeat(ws && ws.readyState === WebSocket.OPEN ? 'ONLINE' : 'OFFLINE', null);
    return;
  }

  if (alarm.name === 'keepAlive') {
    fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${DEVICE_TOKEN}` },
    }).catch(() => {});
  }
});

connectWebSocket();
