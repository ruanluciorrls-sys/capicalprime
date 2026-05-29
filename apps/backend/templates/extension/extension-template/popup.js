import { CONFIG } from './config.js';

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const panelStatusDot = document.getElementById('panelStatusDot');
const panelStatusText = document.getElementById('panelStatusText');
const versionSpan = document.getElementById('version');
const testBtn = document.getElementById('testBtn');
const testPanelBtn = document.getElementById('testPanelBtn');
const resultDiv = document.getElementById('test-result');
const lineDiag = document.getElementById('lineDiag');
const apiDiag = document.getElementById('apiDiag');
const deviceDiag = document.getElementById('deviceDiag');

versionSpan.textContent = CONFIG.VERSION;

function setDot(dotEl, connected) {
  if (!dotEl) return;
  dotEl.className = connected ? 'dot connected' : 'dot';
}

function updateWsUI(connected) {
  setDot(statusDot, !!connected);
  if (statusText) statusText.textContent = connected ? 'Navegador: Conectado' : 'Navegador: Desconectado';
}

function updatePanelUI(connected, error) {
  setDot(panelStatusDot, !!connected);
  if (!panelStatusText) return;
  if (connected) {
    panelStatusText.textContent = 'Painel: Conectado';
  } else if (error) {
    panelStatusText.textContent = `Painel: Desconectado (${error})`;
  } else {
    panelStatusText.textContent = 'Painel: Desconectado';
  }
}

function setResult(text) {
  if (resultDiv) resultDiv.textContent = text;
}

function shortId(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function updateDiagnostics(res) {
  if (lineDiag) lineDiag.textContent = `Linha: ${res?.connectionLine || 'Extensao > VPS > Painel'}`;
  const apiCandidate = Array.isArray(res?.apiUrlCandidates) && res.apiUrlCandidates.length
    ? res.apiUrlCandidates[0]
    : String(CONFIG.API_URL || '-');
  if (apiDiag) apiDiag.textContent = `API: ${apiCandidate}`;
  if (deviceDiag) deviceDiag.textContent = `Device: ${shortId(res?.deviceId)}`;
}

chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
  if (chrome.runtime.lastError) {
    if (statusText) statusText.textContent = 'Navegador: Aguardando...';
    if (panelStatusText) panelStatusText.textContent = 'Painel: Aguardando...';
    updateDiagnostics(null);
    return;
  }

  updateWsUI(!!res?.connected);
  updatePanelUI(!!res?.panelConnected, res?.panelLastError || null);
  updateDiagnostics(res);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'WS_STATUS') {
    updateWsUI(!!msg.connected);
  }

  if (msg.type === 'PANEL_STATUS') {
    updatePanelUI(!!msg.connected, msg.error || null);
  }
});

testBtn?.addEventListener('click', () => {
  setResult('Enviando teste QR...');
  testBtn.disabled = true;

  chrome.runtime.sendMessage({ type: 'TEST_QR' }, (response) => {
    testBtn.disabled = false;

    if (chrome.runtime.lastError) {
      setResult('Falha teste QR: ' + chrome.runtime.lastError.message);
      return;
    }

    if (response?.ok) {
      setResult('Teste QR enviado ao painel com sucesso.');
    } else {
      setResult('Falha teste QR: ' + (response?.error || 'sem resposta'));
    }
  });
});

testPanelBtn?.addEventListener('click', () => {
  setResult('Testando conexao com painel...');
  testPanelBtn.disabled = true;

  chrome.runtime.sendMessage({ type: 'TEST_PANEL_CONNECTION' }, (response) => {
    testPanelBtn.disabled = false;

    if (chrome.runtime.lastError) {
      setResult('Falha teste painel: ' + chrome.runtime.lastError.message);
      updatePanelUI(false, chrome.runtime.lastError.message);
      return;
    }

    if (response?.ok) {
      updatePanelUI(true, null);
      setResult('Conexao com painel OK.');
    } else {
      const error = response?.error || 'sem resposta';
      updatePanelUI(false, error);
      setResult('Falha teste painel: ' + error);
    }
  });
});
