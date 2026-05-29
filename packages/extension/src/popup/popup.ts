import { DeviceRegistry } from '../background/device-registry';

const registry = new DeviceRegistry();
const apiUrl = 'http://177.153.202.47:3001/api/v1';

document.addEventListener('DOMContentLoaded', async () => {
  const token = await registry.getToken();
  const deviceId = await registry.getDeviceId();

  const linkedState = document.getElementById('linked-state')!;
  const unlinkedState = document.getElementById('unlinked-state')!;
  const btnLink = document.getElementById('btn-link') as HTMLButtonElement;
  const btnUnlink = document.getElementById('btn-unlink') as HTMLButtonElement;
  const btnTest = document.getElementById('btn-test') as HTMLButtonElement;
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  const msg = document.getElementById('msg')!;
  const notificationArea = document.getElementById('notification-area')!;
  
  const statusText = document.getElementById('status-text')!;
  const dot = document.getElementById('dot')!;
  const lineDiag = document.getElementById('line-diag')!;

  const updateUI = (hasToken: boolean) => {
    if (hasToken) {
      linkedState.style.display = 'block';
      unlinkedState.style.display = 'none';
    } else {
      linkedState.style.display = 'none';
      unlinkedState.style.display = 'block';
      statusText.textContent = 'Desconectado';
      dot.className = 'dot disconnected';
    }
  };

  const updateWsStatus = (connected: boolean) => {
    if (!token) return; // Se nÃƒÂ£o tem token, mantÃƒÂ©m 'Desconectado'
    statusText.textContent = connected ? 'Conectado' : 'Aguardando conexÃƒÂ£o...';
    dot.className = connected ? 'dot connected' : 'dot disconnected';
  };

  updateUI(!!token);

  // Se tem token, consulta o estado real do WebSocket no background
  if (token) {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) return; // SW ainda acordando
      updateWsStatus(response?.connected === true);
      lineDiag.textContent = response?.connectionLine || 'Extensao > VPS > Painel';
    });
  }

  btnLink.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showMessage('Insira a API Key', false);
      return;
    }

    btnLink.disabled = true;
    btnLink.textContent = 'Vinculando...';

    try {
      // Registrar no backend
      const res = await fetch(`${apiUrl}/extension/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userApiKey: apiKey,
          browser: getBrowserInfo()
        })
      });

      const data = await res.json();

      // Backend retorna { deviceToken, userId } Ã¢â‚¬â€ nÃƒÂ£o hÃƒÂ¡ campo "success"
      if (res.ok && data.deviceToken) {
        await registry.setToken(data.deviceToken);
        showMessage('Dispositivo vinculado com sucesso!', true);

        // Recarregar o service worker com o novo token
        chrome.runtime.reload();

        updateUI(true);
      } else {
        showMessage(data.message || 'Erro ao vincular: API Key invÃƒÂ¡lida', false);
      }
    } catch (err) {
      showMessage('Falha na comunicaÃƒÂ§ÃƒÂ£o com o servidor', false);
    } finally {
      btnLink.disabled = false;
      btnLink.textContent = 'Vincular Dispositivo';
    }
  });

  btnUnlink.addEventListener('click', async () => {
    await registry.clearToken();
    apiKeyInput.value = '';
    showMessage('Dispositivo desvinculado.', true);
    updateUI(false);
  });

  btnTest?.addEventListener('click', async () => {
    btnTest.disabled = true;
    btnTest.textContent = 'Enviando...';
    chrome.runtime.sendMessage({ type: 'TEST_QR' }, (response) => {
      if (response?.success) {
        showNotification('Teste enviado! Verifique a fila do dashboard.', 'success');
      } else {
        showNotification('Falha na conexao com o servidor.', 'error');
      }
      btnTest.disabled = false;
      btnTest.textContent = 'Testar Captura';
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'QR_CAPTURED') {
      showNotification(message.message ?? 'QR capturado! Aguardando aprovacao.', message.level ?? 'success');
    }
    if (message?.type === 'WS_STATUS') {
      updateWsStatus(message.connected === true);
    }
  });

  function showMessage(text: string, success: boolean) {
    msg.textContent = text;
    msg.className = success ? 'success' : 'error';
    setTimeout(() => { msg.textContent = ''; }, 4000);
  }

  function showNotification(text: string, type: 'success' | 'error') {
    notificationArea.textContent = text;
    notificationArea.className = type === 'success' ? 'note-success' : 'note-error';
    setTimeout(() => {
      notificationArea.textContent = '';
      notificationArea.className = '';
    }, 3000);
  }

  function getBrowserInfo() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Google Chrome';
    if (ua.includes('Edg')) return 'Microsoft Edge';
    if (ua.includes('Brave')) return 'Brave';
    return 'Unknown Browser';
  }
});


