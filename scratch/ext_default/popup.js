document.addEventListener('DOMContentLoaded', () => {
  const dot = document.getElementById('dot');
  const statusText = document.getElementById('statusText');
  const testBtn = document.getElementById('testBtn');
  const messageDiv = document.getElementById('message');
  const versionSpan = document.getElementById('version');
  versionSpan.textContent = `v${chrome.runtime.getManifest().version}`;

  async function updateStatus() {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (resp?.status === 'connected') {
      dot.className = 'dot online';
      statusText.textContent = 'Conectado';
    } else {
      dot.className = 'dot offline';
      statusText.textContent = 'Desconectado';
    }
  }

  testBtn.addEventListener('click', async () => {
    messageDiv.innerHTML = '';
    messageDiv.textContent = 'Enviando...';
    const resp = await chrome.runtime.sendMessage({ type: 'TEST_QR' });
    if (resp?.success) {
      messageDiv.textContent = '✅ Teste enviado! Verifique o dashboard.';
      messageDiv.className = 'success';
    } else {
      messageDiv.textContent = `❌ Falha: ${resp?.message || 'Erro'}`;
      messageDiv.className = 'error';
    }
    setTimeout(() => { messageDiv.textContent = ''; }, 5000);
  });

  setInterval(updateStatus, 3000);
  updateStatus();
});
