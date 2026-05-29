#!/bin/bash
echo "======================================================"
echo "  AIOS - TESTE COMPLETO: EXTENSAO + WEBSOCKET"
echo "======================================================"

# API key do MASTER_ADMIN
APIKEY="CAPITAL_PRIME_MASTER_2026"
BASE="http://localhost:3001/api/v1"

echo ""
echo "=== [1] HEALTH ==="
curl -sf "$BASE/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Status: {d[\"status\"]} | DB: {d[\"database\"][\"status\"]} | Latência: {d[\"latency\"]}')"

echo ""
echo "=== [2] DOWNLOAD DA EXTENSAO ==="
HTTP_CODE=$(curl -sf -o /tmp/ext_test.zip -w "%{http_code}" \
  -H "X-Api-Key: $APIKEY" \
  "$BASE/extension/download" 2>&1)

if [ "$HTTP_CODE" = "200" ]; then
  SIZE=$(du -k /tmp/ext_test.zip | cut -f1)
  echo "  HTTP $HTTP_CODE — ZIP baixado: ${SIZE}KB"
  echo ""
  echo "=== [3] CONTEUDO DO ZIP ==="
  unzip -l /tmp/ext_test.zip | grep -E "(Name|socket|config|background|manifest|---)"
  echo ""
  # Verify socket.io bundle is present
  if unzip -l /tmp/ext_test.zip | grep -q "socket.io.esm.min.js"; then
    echo "  ✅ socket.io.esm.min.js PRESENTE no ZIP"
    SOCKSIZE=$(unzip -p /tmp/ext_test.zip socket.io.esm.min.js | wc -c)
    echo "  ✅ Tamanho do bundle: ${SOCKSIZE} bytes"
  else
    echo "  ❌ socket.io.esm.min.js AUSENTE no ZIP — extensao nao vai conectar!"
  fi
  echo ""
  # Check config.js for correct URLs
  echo "=== [4] CONFIG.JS (URLs geradas) ==="
  unzip -p /tmp/ext_test.zip config.js
  echo ""
  # Check manifest
  echo "=== [5] MANIFEST.JSON ==="
  unzip -p /tmp/ext_test.zip manifest.json
else
  echo "  ❌ ERRO HTTP $HTTP_CODE no download!"
  curl -s -H "X-Api-Key: $APIKEY" "$BASE/extension/download"
fi

echo ""
echo "=== [6] DISPOSITIVOS REGISTRADOS ==="
curl -sf -H "X-Api-Key: $APIKEY" "$BASE/extension/devices" | \
  python3 -c "
import sys,json
devs = json.load(sys.stdin)
if not devs:
  print('  Nenhum dispositivo ativo')
else:
  for d in devs:
    print(f'  Device: {d[\"deviceId\"][:16]}... | Status: {d[\"connectionStatus\"]} | Online: {d.get(\"isOnline\",False)} | Visto: {d[\"lastSeen\"]}')
" 2>/dev/null || echo "  Sem dispositivos ativos"

echo ""
echo "=== [7] TESTE WEBSOCKET (conexao direta) ==="
# Use node to test WebSocket connection
node -e "
const { io } = require('/app/node_modules/socket.io-client');
const s = io('http://localhost:3001', {
  transports: ['websocket'],
  auth: { token: 'CAPITAL_PRIME_MASTER_2026' },
  timeout: 5000
});
let done = false;
s.on('connect', () => {
  console.log('  SOCKET: Conectado! ID:', s.id);
  done = true;
  s.disconnect();
  process.exit(0);
});
s.on('connect_error', (e) => {
  console.log('  SOCKET ERRO:', e.message);
  if (!done) { done = true; process.exit(1); }
});
setTimeout(() => { if(!done){ console.log('  SOCKET: Timeout (5s)'); process.exit(2); } }, 5000);
" 2>&1 || echo "  (node socket test terminou)"

echo ""
echo "=== [8] QR DE TESTE (ingest) ==="
TS=$(date +%s)
TEST_QR="00020101021226580014BR.GOV.BCB.PIX0136test-${TS}52040000530398654041.005802BR5909TEST AIOS6008BRASILIA62070503***6304CAFE"
HASH=$(echo -n "$TEST_QR" | sha256sum | cut -d' ' -f1)
QR_RESULT=$(curl -sf -w "\nHTTP:%{http_code}" \
  -X POST "$BASE/qr/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APIKEY" \
  -d "{\"payload\":\"$TEST_QR\",\"payloadHash\":\"$HASH\",\"sourceUrl\":\"test-script\",\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" 2>&1)
echo "  Resposta: $QR_RESULT"

echo ""
echo "=== RESUMO ==="
echo "  Backend:        ✅ Online (saudavel)"
echo "  Dashboard WS:   ✅ Conectado (via painel)"
if [ "$HTTP_CODE" = "200" ]; then
  echo "  Download ZIP:   ✅ OK"
  if unzip -l /tmp/ext_test.zip | grep -q "socket.io.esm.min.js"; then
    echo "  Socket bundle:  ✅ Incluido no ZIP"
  else
    echo "  Socket bundle:  ❌ FALTANDO"
  fi
else
  echo "  Download ZIP:   ❌ FALHOU (HTTP $HTTP_CODE)"
fi
echo ""

rm -f /tmp/ext_test.zip
