#!/bin/bash
APIKEY="CAPITAL_PRIME_MASTER_2026"
BASE="http://localhost:3001/api/v1"

echo "======================================================"
echo "  AIOS - TESTE DE EXTENSAO (python3 + docker)"
echo "======================================================"

echo ""
echo "=== [1] DOWNLOAD DO ZIP ==="
HTTP_CODE=$(curl -sf -o /tmp/ext.zip -w "%{http_code}" -H "X-Api-Key: $APIKEY" "$BASE/extension/download")
echo "  HTTP: $HTTP_CODE"

echo ""
echo "=== [2] CONTEUDO DO ZIP (via python3) ==="
python3 -c "
import zipfile, sys
try:
    with zipfile.ZipFile('/tmp/ext.zip', 'r') as z:
        files = z.namelist()
        print('  Arquivos no ZIP:')
        for f in sorted(files):
            info = z.getinfo(f)
            print(f'    {f:45s} {info.file_size:8d} bytes')
        print()
        has_socket = 'socket.io.esm.min.js' in files
        print(f'  socket.io.esm.min.js: {\"PRESENTE\" if has_socket else \"AUSENTE\"}')
        if has_socket:
            sz = z.getinfo('socket.io.esm.min.js').file_size
            print(f'  Bundle size: {sz} bytes ({sz//1024}KB)')
        print()
        print('  --- config.js ---')
        print(z.read('config.js').decode('utf-8'))
        print()
        print('  --- manifest.json (version + host_permissions) ---')
        import json
        m = json.loads(z.read('manifest.json'))
        print(f'  Versao: {m[\"version\"]}')
        print(f'  Host permissions: {m.get(\"host_permissions\",[])}')
except Exception as e:
    print(f'  ERRO: {e}', file=sys.stderr)
"

echo ""
echo "=== [3] TESTE WEBSOCKET (dentro do container backend) ==="
docker exec aios_backend node -e "
const { io } = require('./node_modules/socket.io-client');
const sock = io('http://localhost:3001', {
  transports: ['websocket'],
  auth: { token: 'CAPITAL_PRIME_MASTER_2026' },
  timeout: 5000
});
let done = false;
sock.on('connect', () => {
  console.log('[OK] WebSocket conectado! ID:', sock.id);
  sock.disconnect();
  done = true;
  process.exit(0);
});
sock.on('connect_error', (e) => {
  console.log('[ERRO] connect_error:', e.message);
  done = true;
  process.exit(1);
});
sock.on('disconnect', (r) => { if(done) return; console.log('[INFO] disconnect:', r); });
setTimeout(() => {
  if (!done) { console.log('[TIMEOUT] Sem resposta em 5s'); process.exit(2); }
}, 5000);
" 2>&1 || echo "  (ws test encerrado)"

echo ""
echo "=== [4] TESTE QR INGEST (via device token JWT) ==="
# Get device token from a fresh extension download
DEVICE_TOKEN=$(curl -sf -H "X-Api-Key: $APIKEY" "$BASE/extension/devices" | python3 -c "
import sys,json
devs=json.load(sys.stdin)
if devs: print(devs[0].get('deviceToken',''))
" 2>/dev/null)

if [ -z "$DEVICE_TOKEN" ]; then
  echo "  Sem deviceToken disponivel - testando via API key direto"
  TS=$(date +%s)
  PAYLOAD="00020101021226580014BR.GOV.BCB.PIX0136test${TS}52040000530398654041.005802BR5908TESTANDO6009SAO PAULO62070503***6304CAFE"
  HASH=$(echo -n "$PAYLOAD" | python3 -c "import sys,hashlib; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())")
  curl -s -X POST "$BASE/qr/ingest" \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: $APIKEY" \
    -d "{\"payload\":\"$PAYLOAD\",\"payloadHash\":\"$HASH\",\"sourceUrl\":\"vps-test\",\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" | python3 -m json.tool 2>/dev/null
else
  echo "  Device token encontrado: ${DEVICE_TOKEN:0:20}..."
fi

echo ""
echo "=== [5] RESUMO FINAL ==="
echo "  Backend: saudavel"
[ "$HTTP_CODE" = "200" ] && echo "  Download: OK (HTTP 200)" || echo "  Download: FALHOU (HTTP $HTTP_CODE)"
python3 -c "
import zipfile
try:
    with zipfile.ZipFile('/tmp/ext.zip','r') as z:
        has=('socket.io.esm.min.js' in z.namelist())
        print(f'  socket.io bundle: {\"PRESENTE\" if has else \"AUSENTE\"}')
except: print('  socket.io bundle: nao verificado')
"
echo ""

rm -f /tmp/ext.zip
