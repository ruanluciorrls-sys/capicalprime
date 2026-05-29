# 09 - FLUXOS

**Objetivo:** Explicar o funcionamento de negócio dos fluxos principais.

## Fluxo 1: Vinculação da Extensão
1. O usuário acessa o Dashboard, vai em **Configurações** e copia sua **API Key**.
2. O usuário instala a Extensão no navegador e clica no ícone.
3. No popup, ele cola a API Key.
4. A extensão faz um POST para `/extension/register` informando a API Key e um Device ID único gerado por ela mesma.
5. O Backend valida a API Key, cria/atualiza o dispositivo na tabela `extension_devices` e retorna um **Device Token (JWT)**.
6. A extensão guarda o JWT localmente e abre a conexão WebSocket com o servidor, passando o token.

## Fluxo 2: Captura e Triagem de QR Code (Realtime)
1. A Extensão varre os nós da DOM procurando `<canvas>` ou `<img>`.
2. Encontrando, decodifica a imagem usando `jsQR`.
3. Se for um Payload Pix EMV válido, faz um Hash SHA-256 e verifica se já viu localmente.
4. Faz POST para `/qr/ingest` autenticado via JWT.
5. O Backend salva como `PENDING` e dispara o evento interno `qr.new`.
6. O `QrGateway` pega o evento e avisa o Dashboard via Socket.io no client.
7. A tela do Dashboard brilha em tempo real alertando o pagamento.

## Fluxo 3: Pagamento (Adapter)
1. Usuário clica em **Aprovar** no Dashboard.
2. POST `/qr/:id/approve` com API Key.
3. O `QrService` muda status para `APPROVED` e dispara o evento interno `qr.approved`.
4. O `EventsService` escuta o evento e aciona o `PaymentsService.execute()`.
5. O `PaymentsService` olha para o usuário, identifica que o banco dele é **Asaas** (ou Mock).
6. Instancia o Adapter correto via Factory.
7. Executa o POST na API do Asaas.
8. Retorna o ID End-to-End bancário, atualiza para `SUCCESS` e notifica o Dashboard.

## Espaço para Futuras Atualizações
*(Adicione fluxos de conciliação e webhooks futuros)*
