# CHANGELOG

## [2.4.5] - 2026-05-29

### Corrigido (Deploy VPS / SSH timeout)
- **Conectividade do deploy validada**: `177.200.149.117` nao respondeu em `SSH :22` (timeout), enquanto `177.153.202.47` respondeu com sucesso.
- **Rollback de host ativo**: scripts e defaults de conexao voltaram para `177.153.202.47` para restaurar deploy e comunicacao da extensao sem timeout.
- **Extensao local**: configuracao usada no navegador foi realinhada para `http://177.153.202.47:3001`.

### Versao
- Sistema, Backend, Dashboard, Extension: `2.4.4` -> `2.4.5`

## [2.4.4] - 2026-05-29

### Corrigido (Conexao da extensao sem queda por 401/403)
- **DeviceTokenGuard resiliente**: backend agora aceita token de dispositivo ativo do banco mesmo quando a validacao JWT falha por rotacao de segredo, evitando desconexao da extensao apos deploy.
- **Headers de autenticacao reforcados**: extensao passa a enviar `Authorization` + `X-Device-Token` em `heartbeat`, `qr/ingest` e `qr/raw-capture`, melhorando compatibilidade em Chromium customizado.
- **Cooldown de auth padronizado**: falhas `401/403` retornam `auth_block_cooldown` e atualizam status do painel como `token_invalido_ou_expirado`, reduzindo flood de tentativas.
- **Download da extensao no dashboard**: rota interna agora aceita `Bearer` e/ou `X-Api-Key` para buscar o ZIP, eliminando `401` quando a api key local estiver desatualizada.
- **Origem/IP atualizados**: defaults de VPS foram alinhados para `177.200.149.117` no backend/extensao/deploy.

### Versao
- Sistema, Backend, Dashboard, Extension: `2.4.3` -> `2.4.4`

## [2.4.3] - 2026-05-29

### Corrigido (Triangulo Extensao -> VPS -> Painel)
- **Contrato de conexao VPS-only**: em producao, o backend nao cai mais em `localhost` ao gerar o ZIP da extensao se alguma env publica faltar; o fallback passa a ser a VPS ativa `http://177.153.202.47:3001`.
- **Diagnostico do popup**: extensao agora exibe a linha `Extensao > VPS > Painel`, deixando claro que o navegador envia para a VPS e a VPS repassa os eventos ao painel.
- **Logs da extensao**: conexao e erro Socket.IO passam a registrar a linha de conexao para facilitar diagnostico em Chromium customizado.
- **Extensao empacotada**: permissao direta para `localhost:3001` removida do manifesto da extensao standalone, mantendo a conexao focada na VPS.

### Versao
- Sistema, Backend, Dashboard, Extension: `2.4.2` -> `2.4.3`

## [2.4.2] - 2026-05-29

### Corrigido (IP real ativo da VPS)
- **Conexao restaurada para a VPS ativa**: a propria VPS retornou `HOST_IPS=177.153.202.47`; o IP `177.200.149.117` nao respondeu em SSH, painel ou backend nos testes externos.
- **Painel e extensao**: URLs de API/WS e fallbacks voltaram para `http://177.153.202.47:3001` / `ws://177.153.202.47:3001`, que respondem hoje.
- **`SOLUCAO_FINAL.bat`**: deploy volta a publicar `.env` com o IP real ativo da VPS, evitando gerar ZIP da extensao apontando para endpoint indisponivel.

### Versao
- Sistema, Backend, Dashboard, Extension: `2.4.1` -> `2.4.2`

## [2.4.1] - 2026-05-29

### Corrigido (Conexao pelo IP atual da VPS)
- **WebSocket do painel**: removido o uso automatico de `wss://api.pixcapitalprime.com.br` no deploy enquanto o DNS do dominio ainda nao resolve, evitando falha de conexao antes de chegar no backend.
- **IP publico atual**: scripts, fallbacks da extensao e download do ZIP agora apontam para `177.200.149.117`.
- **`SOLUCAO_FINAL.bat`**: `.env` de producao passa a gravar `PUBLIC_URL=http://177.200.149.117:3001`, `PUBLIC_WS_URL=ws://177.200.149.117:3001`, `NEXT_PUBLIC_API_URL=http://177.200.149.117:3001`, `NEXT_PUBLIC_WS_URL=ws://177.200.149.117:3001` e `NEXT_PUBLIC_APP_URL=http://177.200.149.117:3000`.
- **Extensao**: permissao de host, popup, sender de QR e socket fallback atualizados para o IP atual.

### Versao
- Sistema, Backend, Dashboard, Extension: `2.4.0` -> `2.4.1`

## [2.4.0] - 2026-05-29

### Adicionado (HTTPS/WSS + Conexao estavel extensao <-> painel)
- **Proxy reverso Caddy** (`Caddyfile` + servico `caddy` no `docker-compose.production.yml`): termina SSL automaticamente via Let's Encrypt (portas 80/443) e repassa WebSocket de forma transparente. Atende **dois dominios** em blocos separados (cert independente por nome):
  - PRINCIPAL: `pixcapitalprime.com.br` / `www.` -> dashboard (`:3000`); `api.pixcapitalprime.com.br` -> backend + WS (`:3001`)
  - FALLBACK: `capitaprimeofc.vps-kinghost.net` / `www.` -> dashboard; `api.capitaprimeofc.vps-kinghost.net` -> backend + WS
- **`CORS_ORIGINS`** ampliado para liberar ambos os dominios (`SOLUCAO_FINAL.bat`: vars `FB_DOMAIN`/`FB_API_DOMAIN`).
- **Migracao para dominio + HTTPS/WSS**: extensao e painel passam a usar `https://api.pixcapitalprime.com.br` e `wss://api.pixcapitalprime.com.br` em vez de IP cru com `http`/`ws` (mais seguro para dado de pagamento e mais estavel no Chrome).
- **`INSTALAR.bat`** incluido no ZIP da extensao: assistente que abre o `chrome://extensions` e guia o "Carregar sem compactacao" (Chrome MV3 nao carrega ZIP diretamente).

### Corrigido (Estabilidade do Service Worker â€” `background.js`)
- **Sockets duplicados**: `connectSocket()` agora e idempotente (nao cria novo socket se ja houver um ativo/conectando).
- **Reconexao no ciclo de vida**: listeners `chrome.runtime.onStartup` e `onInstalled` reabrem a conexao quando o Chrome inicia ou a extensao e atualizada.
- **`ensureSocket()`**: reconexao centralizada e idempotente, usada pelo alarm `keepAlive` para acordar o Service Worker (MV3 encerra apos ~30s ocioso) e reconectar sem flood.
- **Heartbeat com dedupe/backoff**: evita repetir o mesmo status em menos de 15s (protege contra o throttle de 200/min); mudancas de estado (connect/disconnect/error) forcam envio imediato.

### Corrigido (Login "Nao foi possivel conectar ao servidor" â€” proxy SSR)
- **Proxy `/api/*` do dashboard apontava para a URL publica HTTPS**: o `next.config.js` avalia `rewrites()` em *build time* e grava o destino no `routes-manifest.json`. Como `INTERNAL_API_URL` so existia em runtime, o destino do proxy era gravado como `https://api.pixcapitalprime.com.br` â€” que nao resolve de dentro do container â€” causando HTTP 500 no login.
- **Correcao**: `INTERNAL_API_URL=http://backend:3001` passado como **build-arg** (`apps/dashboard/Dockerfile` + `docker-compose.production.yml`), garantindo que o proxy SSR seja gravado apontando para o service interno do Docker. Exige rebuild do dashboard.

### Infra / Deploy
- **`SOLUCAO_FINAL.bat`**: variaveis `DOMAIN`/`API_DOMAIN` adicionadas; geracao do `.env` e bloco D6a agora fazem *upsert* das URLs para HTTPS/WSS (substituem valores antigos de IP).
- **`docker-compose.production.yml`**: volumes `caddy_data` / `caddy_config` para persistir certificados SSL.

### Versao
- Backend, Dashboard, Extension: `2.3.0` -> `2.4.0`

## [2.3.0] - 2026-05-28

### Corrigido (Extensao â€” Conexao VPS Online)
- **Raiz do HTTP 403**: identificado que o VPS rodava codigo antigo com `ApiKeyGuard` nos endpoints `/qr/ingest` e `/qr/raw-capture`, que verificava assinatura de plano e retornava 403. O codigo atual ja usa `DeviceTokenGuard` (sem verificacao de assinatura) nesses endpoints â€” corrigido via deploy.
- **Chaves locais no ZIP**: extensao baixada do painel local gerava `CONFIG.API_URL = localhost:3001`. Corrigido com variavel de ambiente `EXTENSION_FORCE_PUBLIC_ORIGIN` que forca a URL publica correta no ZIP independente de onde o backend esta rodando.
- **IP hardcoded removido**: `http://177.153.202.47:3000` removido do codigo-fonte; agora controlado exclusivamente pela env `EXTENSION_FORCE_PUBLIC_ORIGIN` (gerada automaticamente pelo `SOLUCAO_FINAL.bat`).
- **`background.js` â€” status do painel**: adicionados `panelConnected` / `panelLastError` com tracking em tempo real. Heartbeat agora atualiza o status do painel e envia mensagem `PANEL_STATUS` para o popup imediatamente.
- **`background.js` â€” `TEST_PANEL_CONNECTION`**: handler implementado; popup agora consegue testar se o token e reconhecido pelo VPS (heartbeat com autenticacao real).
- **`background.js` â€” `GET_STATUS`**: resposta expandida com `panelConnected`, `panelLastError`, `deviceId`, `apiUrlCandidates` para o popup exibir diagnostico completo.
- **`background.js` â€” campos extras em `RAW_QR_CAPTURED`**: removidos `type`, `qrCode`, `source`, `timestamp`, `orderId`, `amount` do payload de `/qr/raw-capture`. Esses campos nao existem em `RawQrCaptureDto` e causavam erro 400 com `forbidNonWhitelisted: true`.
- **`background.js` â€” erro HTTP mais descritivo**: erros de `/qr/ingest` e `/qr/raw-capture` agora extraem `errData.message` do JSON de resposta do NestJS em vez de apenas logar o status HTTP.
- **`SOLUCAO_FINAL.bat`**: `EXTENSION_FORCE_PUBLIC_ORIGIN=http://{VPS}:3001` adicionado ao .env gerado e ao bloco D6a de injecao de URLs ausentes.
- **`docker-compose.production.yml`**: variavel `EXTENSION_FORCE_PUBLIC_ORIGIN` passada para o container backend.

### Versao
- Backend, Dashboard, Extension: `2.2.4` -> `2.3.0`

## [2.2.4] - 2026-05-28

### Corrigido (Conexao Extensao em VPS / Chromium custom)
- Geracao do ZIP da extensao ficou mais robusta para ambiente online: URLs internas/inseguras (`localhost`, `backend`, IP privado, `.local`) agora sao tratadas como nao publicas e substituidas pelo hint publico da requisicao.
- Normalizacao da base da extensao reforcada: remove sufixos `/api` e `/api/v1`, padroniza protocolo e continua auto-ajustando `:3000 -> :3001` para evitar `403` no `/qr/ingest`.
- Route do dashboard (`/api/extension/download`) passou a montar melhor o `publicBaseHint` com `x-forwarded-proto` + `x-forwarded-host`, reduzindo divergencia local x VPS atras de proxy.
- Popup da extensao ganhou diagnostico rapido de conexao (`API` e `Device`) para identificar em segundos quando a extensao carregada esta apontando para endpoint/token antigo.
- Erro de painel no popup ficou mais claro para auth/token (`token_invalido_ou_expirado`) em casos de `401/403`.
- Ajustado falso "token invalido" no popup: falhas de envio de QR nao bloqueiam mais o teste de painel/heartbeat.
- `Teste Painel` agora ignora cooldown anterior e valida o estado real da conexao imediatamente.
- Cooldown de auth passou a ser aplicado somente no fluxo de conectividade do painel (heartbeat), evitando travar diagnostico por erro transitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rio no `/qr/ingest`.
- Geracao e uso de token da extensao passaram a ser forcados para o VPS (`http://177.153.202.47:3000`/`3001`), removendo dependencia de origem local no download da extensao.

- Compatibilidade reforcada para Chromium customizado/ungoogled: Socket.IO agora suporta fallback de handshake (query token/apiKey) e ordem de transporte adaptativa (polling primeiro em ungoogled).
- Fallback de API/WS da extensao fixado para o VPS (177.153.202.47) mesmo quando perfil antigo carregar config local.

## [2.2.3] - 2026-05-28

### Corrigido (Hotfix Asaas)
- Corrigido erro de pagamento com mensagem **"Informe o valor a ser transferido."** em alguns fluxos de Pix dinÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢mico.
- No `AsaasPaymentAdapter`, quando o pagamento dinÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢mico falha por ausÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia de `value`, o sistema agora faz **retry automÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡tico** incluindo `value`:
  - no fluxo `payViaDecodedId` (QR decodificado com ID)
  - no fluxo `payViaPayload` (fallback por payload direto)
- Mantida a lÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³gica principal de tentar sem `value` primeiro para nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o quebrar cenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rios em que o PSP exige leitura exclusiva do valor no prÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³prio QR.

### Corrigido (Heartbeat Extensao)
- Endpoint POST /api/v1/extension/heartbeat agora valida payload com DTO e recusa heartbeat invalido.
- deviceId vazio/ausente retorna erro claro (400) em vez de update silencioso.
- status fora de ONLINE|OFFLINE|ERROR retorna erro claro (400).
- Heartbeat com deviceId nao registrado retorna 404 com log [HEARTBEAT] deviceId nao registrado.
### Corrigido (Asaas API Key)
- A validacao de chave Asaas em PATCH /api/v1/users/me/bank-config/asaas/:environment ficou mais robusta.
- O endpoint /accounts agora e fallback nao bloqueante (algumas chaves validas nao tem permissao nele).
- A validacao principal passa por /myAccount/* e /finance/balance.
- Chave colada com caracteres invisiveis (u200B/u200C/u200D) agora e normalizada antes do teste/salvamento.
### Corrigido (Bootstrap Backend)
- Corrigido erro de injecao no NestJS: AuthService nao resolvia EmailService.
- AuthModule agora importa CommonModule, disponibilizando EmailService no contexto de autenticacao.
### Corrigido (Download da Extensao no VPS)
- O gerador de ZIP agora prioriza o template moderno em apps/backend/templates/extension/extension-template.
- Isso evita empacotar o template legado de templates/extension que causava divergencia de comunicacao (offline/401) no painel de extensoes.
- Mantido fallback para template legado apenas se o moderno nao existir.
### Corrigido (Conexao Painel x Extensao)
- Heartbeat da extensao agora aceita retrocompatibilidade: quando `deviceId` nao vier no body, o backend resolve pelo `DEVICE_TOKEN`.
- Endpoint `POST /api/v1/extension/heartbeat` passou a exigir `DeviceTokenGuard`, evitando heartbeat sem autenticacao valida.
- Adicionado suporte ao env `EXTENSION_PUBLIC_API_BASE_URL` no gerador do ZIP para forcar URL publica correta da API da extensao.
- Template legado (`templates/extension/background.js`) agora envia `deviceId` no heartbeat para reduzir status falso de offline.
- Gerador do ZIP agora auto-corrige URL da extensao quando cair na porta do painel (`:3000`), ajustando automaticamente para backend (`:3001`) para evitar `HTTP 403` no `/qr/ingest`.
### Alterado (Deploy Unificado)
- `SOLUCAO_FINAL.bat` agora suporta modos `DEPLOY_ONLY` e `AUTO_DEPLOY` para padronizar o deploy em um unico ponto.
- `_DEPLOY.bat`, `_DEPLOY_VPS.bat` e `_deploy_online.bat` foram unificados para chamar `SOLUCAO_FINAL.bat AUTO_DEPLOY`.
- O `.env` de producao no deploy passou a garantir `EXTENSION_PUBLIC_API_BASE_URL=http://<VPS_HOST>:3001`.
- `SOLUCAO_FINAL.bat` agora abre em modo automatico por padrao (sem prompts de confirmacao/pause), executando fluxo completo ao iniciar.
- Adicionado argumento `MANUAL` para voltar ao comportamento interativo quando necessario.
- Corrigido fechamento automatico indesejado ao abrir o `.bat` direto: agora a janela permanece aberta por padrao no fim/erro.
- Adicionado argumento `NO_PAUSE` para fechar automaticamente quando desejado em chamadas encadeadas.
### Corrigido (Chrome Indetectavel / Extensao Detectavel)
- A listagem e o teste de extensoes no backend agora consideram `heartbeat` recente como sinal de dispositivo detectavel.
- `GET /api/v1/extension/devices` marca `isOnline=true` quando houver WS conectado **ou** heartbeat `ONLINE` recente (janela de 2 minutos).
- `POST /api/v1/extension/devices/:deviceId/test` tambem usa fallback de heartbeat recente para evitar falso offline em quedas transitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rias de socket.
- Template moderno da extensao (`extension-template/background.js`) agora envia heartbeat em `connect`, `disconnect`, `connect_error` e no alarme de keep-alive.
- Socket da extensao moderna agora usa fallback `transports: ['websocket', 'polling']` para melhorar compatibilidade em Chromium customizado.
- Extensao moderna agora tem fallback de endpoint para envio (`/api/v1` direto e proxy `/api`) e cooldown anti-spam ao receber `401/403`, reduzindo erro repetitivo `HTTP 403` no scanner.
- Extensao moderna passou a enviar tambem o header `X-Device-Token` no ingest/raw-capture (alem de `Authorization: Bearer`) para maior compatibilidade com proxy/WAF.
- `DeviceTokenGuard` no backend agora aceita token por `Authorization` **ou** `X-Device-Token`, reduzindo erro de autorizacao em cenarios de proxy que filtram `Authorization`.
- `content.js` da extensao moderna agora extrai Pix tambem da URL da pagina (`qrcode`, `pix`, `payload`, etc.), incluindo payload URL-encoded (`%20`), evitando falso "QR detectado" sem captura.
- Regex de extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o no content script foi reforÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ada para padrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o completo `000201 ... br.gov.bcb.pix ... 6304XXXX`, incluindo leitura de `input`/`textarea`.
- Compatibilidade WS reforcada para navegadores Chromium customizados: extensao moderna agora envia token no Socket.IO via `auth` **e** `query` (`token`/`apiKey`), como fallback para cenarios onde `auth` do handshake ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© bloqueado.
- Fluxo local x VPS unificado no download da extensao: backend agora resolve a base de conexao priorizando origem publica da requisicao (header `X-Extension-Public-Api-Base-Url`), evitando ZIP online com `localhost`.
- Dashboard (`/api/extension/download`) passou a repassar a origem publica para o backend ao gerar o ZIP, reduzindo divergencia de conexao entre ambiente local e VPS.
- Adicionada adaptacao especifica para `ungoogled-chromium`: Socket.IO com modo `polling -> websocket`, fallback entre multiplas WS_URLs (porta 3001/3000) e reconexao controlada por candidato.
- Popup da extensao modernizado com dois status separados: `Navegador (WS)` e `Painel (API)`.
- Novo botao `Teste Painel` no popup para validar envio autenticado ao backend (`/extension/heartbeat`) sem depender do fluxo de captura QR.
- Background da extensao agora publica `PANEL_STATUS` em tempo real e responde `GET_STATUS` com diagnostico completo (`panelConnected`, `panelLastError`, `panelLastSuccessAt`).
## [2.2.2] - 2026-05-28

### Alterado (Extensao MV3)
- DetecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de payload Pix no content script padronizada para o critÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rio universal:
  - comeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a com `000201`
  - contÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m `br.gov.bcb.pix` (case-insensitive)
  - termina com `6304` + 4 hex (`6304XXXX`)
  - tamanho mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimo de seguranÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a
- Adicionadas funÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes centrais de captura:
  - `normalizePixText`
  - `isPixCandidate`
  - `extractPixPayloadsFromText`
- Varredura ativa em:
  - `document.body.innerText`
  - `input` e `textarea`
  - botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes e elementos visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis
  - clipboard (paste e clique em botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de copiar)
  - resultado de leitura visual (`jsQR`)
- Fluxo de envio atualizado:
  - content script envia `PIX_CODE_DETECTED`
  - background valida novamente antes de `/qr/ingest`
  - invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidos nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o para `/qr/ingest` e seguem para `/qr/raw-capture`
- Anti-repetiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o por hash SHA-256 com cooldown de 2 minutos para o mesmo payload.
- Logs operacionais adicionados para rastreio completo de captura/validaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o/envio.

### Mantido (Sem Quebra)
- ConexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Socket.IO/WebSocket da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o preservada.
- `TEST_QR` preservado.
- Popup, token e vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nculo de usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio preservados.

## [2.2.1] - 2026-05-27

### Corrigido (CRÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂTICO)
- **"O payload informado ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido" ao pagar PIX dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢mico via Asaas.** TrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªs causas combinadas, todas corrigidas:
  1. **PIX dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢mico com valor fixo nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o deve enviar o campo `value`** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Asaas lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª o valor diretamente da URL do QR. Enviar `value` diferente do embarcado (mesmo por diferenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a de ponto flutuante) causava rejeiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o imediata. Agora `payments.service.ts` detecta via `parsePix(payload).url` se ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© PIX dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢mico e passa `isDynamic: true` para o adapter, que omite o campo `value` no corpo da requisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
  2. **Payload com whitespace** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â chars invisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis (espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§os, `\n`, zero-width) sobreviviam do armazenamento no BD e invalidavam o payload na Asaas. Agora tanto o adapter (`pay()` e `decodeQr()`) quanto o service fazem `.replace(/\s+/g, '').trim()` antes de qualquer chamada ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  API.
  3. **Sem log do body completo do erro** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â em falha, sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ loggÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vamos `data.errors[0].description`; o body real da Asaas ficava oculto. Agora `pay()` lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª o corpo como texto, faz o parse seguro e loga `rawText.slice(0, 500)` em caso de erro, facilitando diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico futuro.
- **Interface `PayPixInput`** recebeu campo `isDynamic?: boolean` com JSDoc explicando a semÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ntica.

## [2.2.0] - 2026-05-27

### Corrigido (CRÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂTICO)
- **PIX dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢mico agora exibe o valor na fila automaticamente ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â com fallback duplo.** TrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªs correÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes combinadas:
  1. `handleQrEnrichment` checava `user.bankAdapter === 'asaas'` antes de chamar o decode; como o default no banco ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© `'mock'`, nenhum QR dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢mico era enriquecido. Agora busca a chave de produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o diretamente em `bankConfig.asaas.production/production2/production3`, ignorando `bankAdapter`.
  2. `AsaasPaymentAdapter.decodeQr` usava `GET /pix/qrCodes/decode?payload=...` (query string), mas a API Asaas exige `POST /pix/qrCodes/decode` com body `{ payload }`. Trocado para POST + Content-Type JSON. TambÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m ampliado o mapeamento de campos da resposta (`totalValue`, `value`, `amount`, `valor`, `transactionAmount`, `payment.value`) para cobrir variaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes.
  3. Adicionado **fallback BACEN direto**: nova funÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o `fetchDynamicPixFromUrl` busca direto na URL do PIX (campo 26 sub-tag 25, ex: `qrcodes.saq.digital/v2/qr/cob/...`), decodifica JWS (3 partes base64url) ou JSON, e extrai `valor.original`/`recebedor.nome` etc. Roda como EstratÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gia 2 sempre que o Asaas decode nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o retorna `amount` vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido. Timeout de 5s via `AbortSignal.timeout`.
- **Saldo principal no header puxa exclusivamente da API de produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Asaas.** `getBalance()` em `payments.service.ts` foi reescrito: percorre `production ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ production2 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ production3`, forÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a `baseUrl: https://api.asaas.com/v3`, e retorna `{ configured: false, available: null }` quando nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ chave (em vez de `available: 0`, que escondia o saldo armazenado por causa do operador `??`).
- **Parser PIX EMV agora limpa o payload antes da decodificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o TLV.** O `parsePix()` (em `packages/shared/utils/pix-parser.ts` + dist compilada) chamava `parseTLV(payload)` com o payload sujo; o `isPix()` limpava internamente, mas o `parseTLV` recebia espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§os/chars invisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis, deslocando todos os offsets e zerando amount/merchantName/pixKey. SoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o: `parseTLV(clean)` com regex `\s+` + zero-width chars.
- **Ingest da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o e ingest manual agora normalizam o payload** antes de calcular hash e parsear. Hash sempre derivado do payload limpo para dedupe consistente.
- **Default do `AsaasPaymentAdapter`** alterado de sandbox (`api-sandbox.asaas.com/v3`) para produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o (`api.asaas.com/v3`) quando `baseUrl` nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ no config.
- **Header do dashboard**: comparaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de saldo trocada de `availableBalance ?? asaasBalance ?? null` para checagem explÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cita com `!== null && !== undefined`, evitando que `0` legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timo sobrescreva valor armazenado.

### Adicionado
- **Endpoints `GET/PATCH /api/admin/users/:id/preferences`** no backend (admin.controller + admin.service). Carrega/salva `autoPayEnabled`, `autoPayDelaySeconds` (5ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ10s) e `rotationInterval` (2ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ20) por usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio, com clamp de seguranÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a nos limites.
- **Toggle PIX AutomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico sempre visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel na fila** (`QrQueue.tsx`). Antes sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ aparecia quando havia QRs pendentes; agora exibe o painel tambÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m no estado vazio (`autoPayPanel` extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do para variÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vel compartilhada).
- **Toggle PIX AutomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico no painel lateral** (`ManualQrPay.tsx`). Mini-switch dourado com leitura/escrita via `/api/users/me/bank-config`.
- **VersÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do sistema visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel em 2 lugares**: nova constante `APP_VERSION` em `apps/dashboard/lib/version.ts` (fonte ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnica, manter sincronizada com `package.json`). Exibida como badge dourado `v2.2.0` ao lado do tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo "Painel Master Admin" e como rodapÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© `Sistema v2.2.0` abaixo do copyright na tela de login.
- **Modo batch no QR Code manual**: cole 1 ou vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios payloads Pix de uma vez (um por linha **ou** colados juntos sem separador) e todos vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pra fila em sequÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia. Nova funÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o `splitPayloads` detecta mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltiplos QRs quebrando por `\n` e pelo prefixo `000201`. UI mostra badge "N QR Codes detectados", lista vertical de resultados (1 abaixo do outro) com status por item (pendente/enviando/sucesso/duplicado/erro), barra de progresso no botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o (`Enviando 3/7...`) e resumo final (`5 adicionados ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ 1 duplicado ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ 0 erros`). Modo single (1 QR) mantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m comportamento original intacto.
- **Dropdown multi-conta no saldo do header**: clicando no saldo, abre lista com nome + saldo de cada conta de produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o conectada. ChevronDown indica que ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© clicÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vel; fecha em click-outside via `useRef + mousedown` listener.
- **Indicador visual "Buscando valor via Asaas..."** com `Loader2` animado nos cards da fila para QRs dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢micos enquanto o enriquecimento estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ em andamento (substitui o antigo `AlertCircle` que parecia erro).
- **Fallback de timeout no card da fila**: apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s 15s sem resposta do enriquecimento, o spinner ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© substituÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do pelo aviso "Valor indisponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â PIX dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢mico expirado ou inativo. O valor serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ re-consultado automaticamente ao aprovar.". Re-render automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico a cada 5s via `setInterval` enquanto o QR nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ enriquecido.
- **Logs detalhados de enriquecimento** no backend: `[ENRICH] Decodificando...`, `[ENRICH] ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ enriquecido ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â amount=X`, `[ENRICH] PIX pode ter expirado` para facilitar debug.
- **Campo `configured: false`** na resposta de `/api/payments/balance` para distinguir "sem API configurada" de "saldo zero real".

### Alterado
- **Toasts (`react-hot-toast`)** centralizados no inferior da tela (`position="bottom-center"`) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â antes era `bottom-right`.
- **Sandbox excluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do do saldo principal e do `connectedCount`** no `asaasStore.ts`. O rodÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­zio e o saldo do header agora consideram apenas slots de produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o. Sandbox permanece configurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vel mas nunca ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© usado como primÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio.
- **Preview do `ManualQrPay`** para PIX dinÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢mico: texto trocado de "o valor serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ consultado pelo provedor durante o pagamento" para "o valor aparecerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ na fila em instantes apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s o envio", refletindo o enriquecimento sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ncrono no ingest.
- **`fetchBalance` em `qrStore.ts`** trata `configured: false` mantendo `availableBalance = null` em vez de cair em `0`, garantindo que o header nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o exiba "R$ 0,00" quando nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ config.

### Removido
- Import `useCallback` nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o utilizado em `app/dashboard/admin/page.tsx`.

## [10.2.0] - 2026-05-26

### Corrigido
- A captura automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica de QR Code agora envia o conteÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºdo para o mesmo endpoint `/api/v1/qr/ingest` usado pelo botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de teste (TEST_QR).
- O backend deixou de rejeitar conteÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºdos que nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Pix vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidos; aceita qualquer texto e marca como `RAW_CAPTURED` com `canPay=false`.
- Dashboard exibe capturas brutas com badge "ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â  Bruto" e botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de pagamento bloqueado atÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© validaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o posterior.
- Removido o filtro `isPix()` do `qr-detector.ts` que impedia o envio de conteÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºdos reais capturados.

### Adicionado
- Cooldown de 60 segundos no `qr-detector.ts` apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s cada captura, evitando re-scan imediato da mesma pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina.
- Campos `canPay` e `isRaw` na entidade `QrCodeEntity` e no store do dashboard.
- Evento WebSocket `QR_RECEIVED` agora inclui `canPay` e `isRaw` para controle de UI no dashboard.
- Tooltip no botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Aprovar quando `canPay=false`: "ConteÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºdo nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© um Pix vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â pagamento bloqueado atÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© validaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o".

### Mantido
- TEST_QR continua funcionando ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â payloads Pix vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidos seguem com `status=PENDING` e `canPay=true`.
- Anti-repetiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o por hash (QrDedup) mantida com persistÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia em `chrome.storage.local`.
- Compatibilidade total com capturas brutas via `/raw-capture` (endpoint separado mantido).

## [10.1.0] - 2026-05-26

### Adicionado
- Controle de repetiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com pausa de 60 segundos apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s cada tentativa de captura.
- ComparaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o por hash SHAÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“256 do conteÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºdo para evitar envios duplicados.
- Envio padronizado para o endpoint `/api/v1/qr/raw-capture`.
- Logs detalhados com mascaramento do QR Code.

### Corrigido
- Fluxo de captura automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica agora envia corretamente o QR Code para o painel.
- Implementada trava `isProcessing` para evitar sobreposiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de execuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes.

### Mantido
- Todas as funcionalidades existentes (TEST_QR, WebSocket, popup).

## [5.4.0] - 2026-05-24

### Alterado (Apenas UI)
- Removido campo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Saldo disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­velÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â da seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Sandbox nas configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes Asaas.
- Removido saldo do card superior da conta conectada, exibindo agora apenas nome, agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia e conta.

### Corrigido (Captura de Dados da Conta)
- Implementada dupla verificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ao buscar os dados da conta Asaas. Como o endpoint `/accounts` lista apenas subcontas, a extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de dados falhava (AgÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, Conta e Titular nulos) para usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios "padrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" sem contas White-Label.
- O backend agora consulta primeiramente os endpoints diretos (`/myAccount/commercialInfo` para o Titular e `/myAccount/accountNumber` para AgÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia/Conta), e faz fallback para `/accounts` em caso de falha. Isso garante que a identificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o visual da conta no painel apareÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a corretamente tanto para Prod quanto para Sandbox.

## [5.3.0] - 2026-05-24

### Corrigido (Sandbox)
- Corrigida base URL da API Asaas Sandbox para `https://api-sandbox.asaas.com/v3` (endpoint correto conforme documentaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o).
- Adicionado tratamento robusto de resposta (verificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de content-type e fallback de leitura de texto) para evitar erro "Unexpected token '<'".
- Adicionados logs detalhados para diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico de chamadas sandbox e header `User-Agent` (`AI-Project-OS/1.0`).## [5.2.0] - 2026-05-24

### Corrigido
- Endpoints da API Asaas ProduÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o corrigidos para `/accounts` e `/finance/balance` (erro 404 resolvido, URL `api/v3` -> `v3`).
- Removido uso de endpoint invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido (`/myAccount`).
- Adicionados logs detalhados para diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico de falhas no endpoint `/accounts`.## [5.1.0] - 2026-05-24

### Corrigido
- ValidaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da chave Asaas ProduÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o agora ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© feita por chamada real ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  API de produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o (endpoint `/myAccount` com fallback para `/accounts`, e leitura de saldo em `/finance/balance`), nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o mais por formato/regex.
- Removidas validaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes de prefixo, tamanho ou `includes` no fluxo de ProduÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o que rejeitavam chaves vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidas.
- Adicionados logs detalhados para diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico do ambiente produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.

### Melhorado
- Mensagens de erro mais claras quando a chave pertence ao ambiente incorreto.

## [5.0.0] - 2026-05-24

### Adicionado
- Duas seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes independentes na aba ConfiguraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes para API Asaas: ProduÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o e Sandbox.
- Cada ambiente possui seu prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³prio campo de chave, botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de teste, status e exibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de dados.
- LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica de prioridade para alimentar o dashboard: nome e saldo da ProduÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o, agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia/conta da Sandbox.
- PersistÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia separada das duas configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes no backend.

### Melhorado
- Store Zustand unificado para gerenciar as duas contas de forma estruturada.
- Card de resumo no canto superior direito agora exibe informaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes combinadas (Nome, AgÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, Conta e Saldo) ao passar o mouse.
- Logs detalhados para diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico isolado de cada ambiente.

### SeguranÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a
- Impedida a mistura de chaves de produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com URL sandbox (e vice-versa), garantindo isolamento total.## [4.3.0] - 2026-05-24

### Removido
- Campos de agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia e nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero da conta da pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Asaas, pois nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o fornecidos pela API padrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.

### Adicionado
- Layout moderno e responsivo na pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Asaas (cards, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cones, animaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes).
- Store global Zustand `useAsaasStore` para gerenciar nome do titular e saldo.
- Card "Saldo Asaas" no dashboard principal, sincronizado com a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- AtualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica do saldo a cada 1 segundo (polling) para manter os dados sempre atuais.
- Indicadores de loading e toasts de sucesso/erro.

### Melhorado
- ExperiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia visual e interatividade (hover, transiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes, glassmorphism).

## [4.1.0] - 2026-05-24

### Adicionado
- ExibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do **nome do titular** da conta Asaas no cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho, obtido via endpoint `/v3/accounts`.
- ExibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do **saldo** da conta Asaas no cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho, atualizado automaticamente.

### Corrigido
- O resumo "Asaas: nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o conectado" ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© substituÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do pelas informaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes reais quando o token ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© configurado.
- Dados permanecem visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s recarregar a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina.

### ObservaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o
- AgÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia e nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero da conta nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o exibidos, pois a API padrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o os fornece de forma segura. A recomendaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da Asaas ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© usar o modelo BaaS (White Label) para dados cadastrais completos.


## [3.6.0] - 2026-05-24

### Corrigido
- **IntegraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com API Asaas:** Corrigido o mapeamento dos campos retornados pela API. Agora, os dados de titular/empresa, agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia e nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero da conta sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos corretamente do endpoint `/v3/accounts`.
- **PersistÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia de Dados:** As informaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes da conta (titular, agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, conta e saldo) agora sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o salvas no perfil do usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio e carregadas corretamente ao iniciar a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina, garantindo que nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o desapareÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§am apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s atualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- **ExibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o no Frontend:** Os dados sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o exibidos de forma organizada, cada um em sua prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³pria linha, com fallback "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o informado" para campos vazios.

### Adicionado
- **Logs de DiagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico:** Adicionados logs detalhados no backend para registrar a resposta completa da API Asaas, facilitando futuras verificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes.


## [3.5.0] - 2026-05-24

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº Corrigido (Mapeamento e DecriptaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o dos dados da conta Asaas)

- **Bug crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico em `payments.service.ts` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â `decryptObject` corrompendo dados:** O mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `decryptObject` tentava decriptar **todos** os campos do `bankConfig` como se fossem cifrados. Mas o novo formato salva apenas `apiKey` criptografada individualmente ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â os demais campos (`accountHolderName`, `agency`, `accountNumber`, `balance`) sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o texto plano. Resultado: esses campos eram "decriptados" produzindo lixo, e a `apiKey` era eventualmente passada ao adapter ainda criptografada, causando falha de autenticaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o na API Asaas.
- **SoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o:** Adicionado mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo privado `resolveAdapterConfig()` no `PaymentsService` que detecta automaticamente o formato do `bankConfig` (novo vs antigo) e decripta apenas `apiKey` no formato novo. Aplicado em `processPaymentJob`, `getBalance`, `getTransactions` e `debugBalance`.
- **Endpoint `/myAccount` adicionado como primÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio** em `users.service.ts` e `asaas.adapter.ts`: este endpoint retorna os dados da conta de forma mais confiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vel que `/accounts`. Caso falhe (sandbox restrito), faz fallback para `/accounts`.
- **Logs diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sticos adicionados**: todas as respostas da API Asaas sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o logadas em `debug` para facilitar diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³stico futuro sem precisar de Postman.
- `dryRun` agora retorna `null` nos campos vazios (em vez de `"N/A"`) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â consistente com o que o frontend espera.

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€šÃ‚Â¨ Melhorias

- `asaas.adapter.ts` (`getBalance`): agora tambÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m tenta `/myAccount` primeiro antes de `/accounts`, garantindo consistÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia entre salvar e consultar dados.
- Logs de extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o em nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel `LOG` (visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel em produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o) para confirmar os campos extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos: `titular`, `agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia`, `conta`, `saldo`.



### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº Corrigido (PersistÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia dos dados Asaas ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â root cause definitivo)

- **Bug crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico em `settings/page.tsx`:** O `useEffect` de montagem chamava `getBalance()` (endpoint `/payments/balance`) para popular os dados da conta apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s confirmar que havia chave salva. Esse endpoint retorna um shape completamente diferente (`data.available`, `data.accountData`) que nunca corresponde ao esperado ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â resultado: `accountData` e `balance` ficavam `null` e o card da conta nunca renderizava apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s F5. Corrigido para usar diretamente os campos jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ persistidos retornados por `getBankConfig()` (`accountHolderName`, `agency`, `accountNumber`, `balance`).
- **Bug secundÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio em `handleTest` (path sem token novo):** Mesmo problema ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â chamava `getBalance()` com shape errado. Corrigido para chamar `getBankConfig()` e usar os campos persistidos.
- Dados da conta (titular, agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, conta, saldo) agora sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o carregados automaticamente ao acessar qualquer pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina do dashboard, garantindo que **nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o sumam apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s F5 ou fechar/abrir o navegador**.
- `AsaasSummary` (cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho) simplificado para usar a nova aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o `loadAsaasData` do store, eliminando lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica duplicada.

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€šÃ‚Â¨ Melhorias

- Adicionada aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o `loadAsaasData(apiKey)` no store Zustand (`asaasStore.ts`) para centralizar a busca e hidrataÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o dos dados da conta Asaas ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â qualquer componente pode chamÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡-la para garantir dados atualizados.
- `AccountData` no store agora aceita `null` nos campos opcionais, eliminando possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis erros de tipo.
- Evento `asaas-config-updated` continua sendo disparado apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s salvar/remover configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o para atualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o em tempo real do `AsaasSummary`.



### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº Corrigido (PersistÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia dos dados Asaas)
- Os dados da conta (nome, agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, conta, saldo) agora sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o carregados automaticamente ao acessar a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ou o dashboard.
- Os campos nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o desaparecem mais apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s navegaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ou recarregamento da pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina.

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€šÃ‚Â¨ Adicionado
- Estado global utilizando **Zustand** (`useAsaasStore`) para compartilhar os dados da conta Asaas de forma reativa entre os componentes do dashboard.
- Adicionado `useEffect` nos componentes `AsaasSummary` e `SettingsPage` para buscar os dados persistidos no backend ao montar a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina, preenchendo o Zustand store.

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Melhorias
- O resumo no cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho (`AsaasSummary`) agora exibe consistentemente as informaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes da conta (se configurada), refletindo imediatamente mudanÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§as feitas na pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes.

## [2.7.0] - 2026-05-23

### Removido
- OpÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de selecionar ambiente (Sandbox/ProduÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o) na configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Asaas. Agora a integraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o usa URL base fixa (produÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ou variÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vel de ambiente).

### Adicionado
- Busca automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica completa dos dados da conta Asaas: agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero da conta e saldo.
- ExibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o desses dados na pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o e no resumo do cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho.
- AtualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do saldo sempre que o token ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© testado ou salvo.

### Corrigido
- Agora o sistema obtÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m e exibe agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, conta e saldo corretamente (antes estava N/A e R$ 0,00).

## [2.7.0] - 2026-05-23

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº CorreÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes
- **Busca de Dados da Conta Asaas:** Corrigido o parse da resposta da API do Asaas ao salvar ou recuperar configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes. Os dados da conta bancÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ria (agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero da conta com dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­gito) agora sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos corretamente do objeto `accountNumber`, garantindo sua exibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o correta no dashboard ao invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de "AgÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia: N/A" e "Conta: N/A".

## [2.6.0] - 2026-05-23

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€šÃ‚Â¨ Melhorias
- **Busca AutomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica de Dados da Conta Asaas:** Ao salvar o token, o backend agora consulta a API do Asaas para obter e armazenar automaticamente o titular, agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia e nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero da conta.
- **ExibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de Resumo no CabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho:** Foi criado o componente `AsaasSummary` que exibe um resumo da conta conectada (AgÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia/Conta/Titular) no canto superior direito, substituindo o botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de download da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- **PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de ConfiguraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Melhorada:** A pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do Asaas agora exibe as informaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes da conta e o saldo ao testar a conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o, antes de salvar.

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº CorreÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes
- Removido o botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Baixar ExtensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" do cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho global, movendo a funcionalidade para a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes vinculadas, conforme solicitado.

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnico
- Atualizada a lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gica do endpoint `PATCH /users/me/bank-config` para consultar e armazenar os dados da conta retornados pela API Asaas.

## [2.2.0] - 2026-05-23

### Adicionado
- Componente `AsaasSummary` no cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho global (canto superior direito), exibindo agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, conta e nome do titular da conta Asaas conectada.
- Clique no resumo redireciona para a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Asaas.
- Evento `asaas-config-updated` para atualizar o resumo em tempo real apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s salvar/remover configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.

### Corrigido
- Backend agora busca e armazena `accountHolderName`, `agency` e `accountNumber` ao validar o token Asaas (com tentativa em `GET /myAccount`, fallback em `GET /accounts` e `GET /wallet`).
- Endpoint `GET /api/v1/users/me/bank-config` retorna esses dados corretamente sem expor `apiKey`.

### Alterado
- BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Baixar ExtensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" definitivamente removido do cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho (jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ estava, agora garantido fora do header).

## [3.2.0] - 2026-05-23

### Adicionado
- Componente `AsaasSummary` no cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho global, exibindo agÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, conta e titular da conta Asaas conectada.
- Clique no resumo redireciona para a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Asaas.
- BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Baixar ExtensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" movido para a pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes vinculadas.

### Removido
- BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Baixar ExtensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" do cabeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§alho global (canto superior direito).

### Melhorias
- O backend agora salva persistentemente os dados bancÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios da conta Asaas (`accountData`) dentro do campo `bankConfig`.
- AtualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica do resumo Asaas apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s salvar ou remover configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o via evento customizado.
- Responsividade: em mobile, resumo vira ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cone com tooltip.

## [3.1.0] - 2026-05-24

### Adicionado
- **Extrato de transaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes Asaas** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â novo endpoint `GET /payments/transactions` no backend e pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `/dashboard/payments/transactions` no frontend com paginaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o e indicadores de crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito/dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©bito.
- **ValidaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de token antes de salvar** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ao configurar a API Key do Asaas, o sistema agora testa a conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o real com a API e sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ persiste se o token for vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido (retorna erro 400 se invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido).
- **Dados da conta retornados ao salvar** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s validar e salvar o token, o backend retorna Nome, AgÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia, Conta e Saldo disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel para exibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o imediata no dashboard.
- **MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `getTransactions()`** no `AsaasPaymentAdapter` consumindo `/financialTransactions` da API Asaas.
- **Interface `TransactionsOutput` e `TransactionItem`** adicionadas ao `payment-adapter.interface.ts`.
- **Link "Extrato"** adicionado na barra lateral (sidebar) com ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cone `Receipt`.
- **Painel de UsuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `/dashboard/users` com tabela de todos os usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios, status e provedor bancÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio.
- **Painel de Auditoria** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `/dashboard/logs` exibindo histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rico de todas as operaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes do sistema.

### Corrigido
- **Bug crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico (pagamentos falhando silenciosamente):** `processPaymentJob` estava passando `bankConfig` criptografado diretamente ao adapter. Adicionada descriptografia antes de instanciar o adapter ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â pagamentos automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticos agora funcionam corretamente.
- `LogsModule` corrigido: importaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de `UserEntity` adicionada para resolver dependÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia do `ApiKeyGuard`.
- Erros de cache do servidor TypeScript no VS Code (logs.service.ts, logs.controller.ts) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo estava correto, apenas cache do editor precisava ser reiniciado.

### Alterado
- `UsersService.updateBankConfig()` agora injeta `PaymentAdapterFactory` para validar token em tempo real.
- `UsersModule` passou a importar `PaymentsModule` para disponibilizar o `PaymentAdapterFactory`.
- `StatsGrid` e `useAsaasBalance` jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ existentes foram mantidos ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â saldo atualiza a cada 30s automaticamente.

## [3.0.0] - 2026-05-23


### Alterado (BREAKING CHANGE)
- Removida a detecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o visual de QR Code via jsQR (leitura de imagem/canvas).
- SubstituÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­da por **automaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de clique no botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nativo de "Copiar QR Code"** da pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina.
- Prioridade: encontrar botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ clicar ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ capturar texto copiado ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ enviar.

### Adicionado
- Busca inteligente por botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes usando texto visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel, aria-label, title, data-testid, id, class.
- Logs detalhados de cada etapa (botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado, clique, captura, envio).
- Fallback para captura via clipboard (polling e eventos copy/paste) caso o botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o seja encontrado.

### Corrigido
- Captura automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica finalmente funcionando para sites com botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Copiar cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo QR".
- Eliminada a necessidade de permissÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o `clipboardRead`? (ainda necessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ria, mas mantida).
## [2.0.1] - 2026-05-23

### Alterado (Extensao)
- Captura automatica por clipboard reforcada no `content.js`:
  - listener de `copy` em fase de captura com leitura de `navigator.clipboard.readText()` apos 50ms,
  - listener de `paste` com `event.clipboardData.getData('text/plain')`,
  - validacao estrita de payload Pix (`000201` + `0014BR.GOV.BCB.PIX`).
- Dedupe local de curtissima janela (1 segundo) para evitar reenvio imediato do mesmo payload copiado/colado em sequencia.
- Service worker com keep-alive via `chrome.alarms`:
  - alarme `keepAlive` a cada 30 segundos,
  - ping `GET /health` para manter atividade enquanto o Chrome estiver aberto,
  - recriacao do alarme em `onStartup` e `onInstalled`.

### Permissoes
- Confirmado `manifest.json` com `clipboardRead` e `alarms` para suportar captura automatica e keep-alive.

---

## [1.10.0] - 2026-05-23

### Adicionado (Backend & Dashboard)
- **Monitoramento AutomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico via WebSocket**: O backend (`QrGateway`) agora detecta handshakes e encerramentos de conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o WebSocket das extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes e emite os eventos em tempo real (`DEVICE_ONLINE` / `DEVICE_OFFLINE`) para o dashboard (sala do usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio).
- **Status Inicial no Carregamento**: Atualizado o endpoint `GET /extension/devices` no `ExtensionController` para incluir a propriedade `isOnline: boolean` (via consulta ao gateway). O frontend prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©-popula o mapa local de presenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a `onlineStatus` imediatamente no carregamento da tela.
- **SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o no Dashboard**: A pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de ExtensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes (`/dashboard/extensions`) escuta os eventos do socket e re-renderiza o ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cone de Wi-Fi instantaneamente (verde para online, cinza para offline), sem precisar de recarregamento.
- **ManutenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de VerificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Manual**: Mantido o botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Testar ConexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" para forÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ar testes manuais sob demanda, atualizando o mapa local e mantendo o status permanentemente reativo.

---

## [1.9.0] - 2026-05-23

### Adicionado
- BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Testar ConexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" na pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes vinculadas no Dashboard (`/dashboard/extensions`).
- Endpoint `POST /api/v1/extension/devices/:deviceId/test` para verificar se a extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o possui uma conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o WebSocket ativa.
- ManutenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do mapeamento de dispositivos conectados (`deviceSocketMap`) e mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `isDeviceOnline` no `QrGateway` (Backend).

---

## [2.0.0] - 2026-05-23

### Alterado (Extensao)
- Mudanca completa de abordagem: captura de Pix agora e baseada em clipboard (eventos `copy` e `paste`), sem escaneamento visual de canvas/img.
- `content.js` simplificado para:
  - escutar `copy` em fase de captura,
  - ler `navigator.clipboard.readText()` apos 50ms,
  - validar payload Pix (`000201` + `BR.GOV.BCB.PIX`),
  - enviar `QR_DETECTED` automaticamente para o background.
- Fallback implementado no `copy`: se `clipboard.readText()` falhar, tenta capturar o texto selecionado via `window.getSelection()`.
- Listener de `paste` mantido como fallback adicional para capturar payload colado.
- Dedupe de envios mantido no `content.js` para evitar repeticao do mesmo payload.

### Removido
- Toda logica de leitura por imagem/QR visual (`jsQR`, scan em `canvas/img`, `MutationObserver` e loop de `setInterval` para escaneamento).
- Referencia a `jsQR.js` no `manifest.json` do template da extensao.
- Arquivo `jsQR.js` removido do template backend da extensao por nao ser mais utilizado.

### Permissoes
- Adicionada permissao `clipboardRead` no `manifest.json` para leitura da area de transferencia apos gesto de copia.

## [1.8.1] - 2026-05-22

### Corrigido
- **SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de Status WebSocket no Popup**: O `background.js` agora retorna corretamente o status salvo no `chrome.storage.local` para chamadas `GET_STATUS`, operando de maneira assÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ncrona. Isso resolve a falha em que a extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o funcionava (ex: envio de testes), mas o painel insistia em mostrar "WebSocket Desconectado".
- O `popup.js` estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ garantidamente configurado para escutar o evento de mensagem `WS_STATUS` (para atualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes em tempo real) e reflete a interface grÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡fica condizente com a real conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da ferramenta.

---

## [1.6.0] - 2026-05-22

### Corrigido (ExtensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o)
- Status do WebSocket agora reflete corretamente no popup (conectado/desconectado).
- BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Teste" agora gera um payload ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnico a cada clique, evitando bloqueio por duplicidade.
- Captura automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica de QR Code aprimorada: agora detecta tambÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m via colagem (Ctrl+V) e tem fallback periÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dico.
- ComunicaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o entre popup e background melhorada com mensagens de status.

### Corrigido (Backend)
- Endpoint `GET /api/v1/payments/balance` agora retorna 200 com saldo 0 quando o Asaas nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ configurado (em vez de 400).
- Endpoint `GET /api/v1/payments` implementado para listar pagamentos do usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio.

### Melhorias
- Adicionado suporte a captura de QR via `paste` na extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- Popup agora atualiza status em tempo real quando a conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o WebSocket muda.

### DependÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncias
- Nenhuma nova dependÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia.

---

## [1.5.0] - 2026-05-22

### Adicionado
- Endpoint `GET /api/v1/extension/download` para gerar extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Chrome personalizada com device token embutido.
- Template da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com todos os arquivos necessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios (Manifest V3, background, content, popup, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cones PNG vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidos).
- Funcionalidade "Enviar QR de Teste" no popup da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `/dashboard/extensions` listando dispositivos vinculados com opÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de revogaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o "Baixar ExtensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" na pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina `/dashboard/settings` com estado de loading e feedback.
- ValidaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do `manifest.json` dentro do mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo `generateExtensionZip` (lanÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a erro se ausente na raiz do ZIP).

### Corrigido
- **Manifest ausente no ZIP** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â `resolveTemplatePath()` agora verifica a existÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia de `manifest.json` no candidato antes de usÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡-lo, garantindo que o template correto (`extension-template/`) seja selecionado em vez de seu diretÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rio pai.
- **ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âcones PNG corrompidos** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â recriados com estrutura PNG vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida (IHDR + IDAT + IEND), tamanhos 16ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â16, 48ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â48 e 128ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â128.
- **Placeholders nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o substituÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­dos** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â regexes escapam corretamente os caracteres `{}`.
- **BOM UTF-8** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â removido automaticamente de arquivos de texto antes de adicionÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡-los ao ZIP.
- **Arquivos binÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cones)** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â lidos como Buffer em vez de string UTF-8, evitando corrupÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- **`host_permissions` invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidas** ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â removido `{{API_URL}}/*` do manifest (placeholder no campo URL causava JSON invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s substituiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de URL com caracteres especiais); substituÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do por `<all_urls>`.
- Erro 500 ao baixar extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o corrigido ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â `adm-zip` substitui `archiver` para geraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ncrona em memÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ria.

### Melhorias
- `background.js` reescrito: reconexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o WebSocket robusta (sem mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltiplos timers), URL WS construÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­da corretamente de `http://host/api/v1` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ `ws://host/`, notificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ao popup via `chrome.runtime.sendMessage`.
- `content.js` reescrito: deduplicaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de payloads via `Set`, `MutationObserver` para detecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o em SPAs, sem dependÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia externa (jsQR removido ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â detecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o por texto EMV).
- `popup.js` reescrito: sincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com `chrome.storage.local`, escuta de eventos do background em tempo real, feedback visual de sucesso/erro.
- Logging aprimorado no backend (`Logger`) para rastreamento do caminho do template e entradas do ZIP.

### DependÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncias
- `adm-zip` adicionado ao backend.
- `@types/adm-zip` adicionado como devDependency no backend.

---

## [1.4.0] - 2026-05-22

### Adicionado
- PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de API Asaas no dashboard (salvar chave, testar conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o, exibir saldo).
- ExibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de saldo Asaas no `StatsGrid` com atualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o periÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dica via `useAsaasBalance`.
- Hook `useAsaasBalance` para buscar saldo com polling.

### Corrigido
- IntegraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com Asaas agora usa a chave salva pelo usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio (criptografada), nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o mais variÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vel de ambiente.
- Endpoint `PATCH /api/v1/users/me/bank-config` para salvar e criptografar configuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o bancÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ria.
- Endpoint `GET /api/v1/users/me/bank-config` retorna config mascarada (sem expor a chave).
- Endpoint `GET /api/v1/payments/balance` usa adapter do usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio com bankConfig decriptografado.









