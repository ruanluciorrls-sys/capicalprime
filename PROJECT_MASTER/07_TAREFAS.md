# 07 - TAREFAS

**Objetivo:** Controlar o que deve ser feito (ToDo), o que está sendo feito (Doing) e o que já foi finalizado (Done).

## Em Andamento (Doing)
- [ ] Testar ponta-a-ponta o recebimento do QR Code na interface e o pagamento final no Asaas.
- [ ] Implementar WsThrottlerGuard para rate limiting no WebSocket.

## Em Andamento (Doing) — Runtime/Tooling
- [ ] Rodar limpeza completa (`node_modules`) + reinstalação com Node 22.3.0 e validar `turbo run dev` (backend/shared/dashboard).

## Pendente (ToDo)
- [ ] Implementar Design System no Tailwind (Cores Dark, Glassmorphism, Micro-interações).
- [ ] Construir componentes Core UI (Stacked Cards, Realtime Data Table, Advanced Filters).
- [ ] Conectar o `RealtimeProvider` (Socket.io) ao Store do Zustand.
- [ ] Ajustar o Popup da extensão (Design UX refinado).
- [ ] Configurar um container Docker isolado para o Redis (caso horizontalize os WebSockets).
- [ ] Criar testes unitários para o `pix-parser.ts`.
- [ ] Criar testes de integração para fluxo Ingest → Approve → Payment → Webhook.
- [ ] Adicionar suporte ao NextAuth para login web (quando sair da fase Local-first).
- [ ] Implementar refresh token e rotação automática de API Keys.
- [ ] Configurar Bull + Redis para fila de pagamentos (substituir setTimeout).
- [ ] Criar endpoints de gerenciamento de Webhook (registro de URLs de callback).
- [ ] Implementar exportação de relatórios (CSV/PDF) de QR Codes e Pagamentos.
- [ ] Adicionar migração inicial no diretório `database/migrations/`.

## Pendente (ToDo) — Novos
- [ ] Implementar integração com Redis e Bull para substituir a PaymentQueueService in-memory.
- [ ] Migrar retry de setTimeout para PaymentQueueService.
- [ ] Criar endpoints de gerenciamento de BankAccount (CRUD + ativar/desativar).
- [ ] Integrar EncryptionService na criação/leitura de BankAccount.
- [ ] Criar serviço de sincronização de saldos bancários (job periódico).
- [ ] Registrar handlers no PaymentQueueService para processamento de pagamentos.
- [ ] Testar cada adapter individualmente (Asaas, MP, Inter, Efi, BB).
- [ ] Implementar fallback automático entre contas bancárias do mesmo usuário.
- [ ] Criar Dashboard de provedores (features, status, saldo).
- [ ] Implementar exportação de comprovantes (FinancialReceipt).

## Concluído (Done)
- [x] Corrigir DI do backend com `CommonModule` e exportacao de `EncryptionService`, `AuditLogService` e `CacheService`.
- [x] Implementar `DeviceTokenGuard` com validacao de JWT Bearer + device ativo.
- [x] Ajustar execucao workspace no Windows (`npm run dev --workspace=@aios/backend` / `@aios/dashboard`) no `SOLUCAO_FINAL.bat`.
- [x] Padronizar lockfile/workspaces com `.npmrc` (`lockfile-version=3`) e scripts de dev separados na raiz.
- [x] Corrigir dashboard visual e dados (StatsGrid com store real, total pago por `payments.SUCCESS`, saldo Asaas e persistencia websocket `QR_RECEIVED`).
- [x] Criar pagina de configuracao Asaas (`/dashboard/settings`) com salvar chave e teste de conexao (`GET /payments/balance`).
- [x] Implementar endpoint `PATCH /api/v1/users/me/bank-config` com auditoria e criptografia via `EncryptionService`.
- [x] Gerar extensao personalizada via `GET /api/v1/extension/download` (ZIP com arquivos ja vinculados ao usuario).
- [x] Captura de PIX copia/cola na extensao (`paste` em document/input/textarea).
- [x] Implementar cancelamento logico de QR (`DELETE /api/v1/qr/:id`) + evento realtime `qr.cancelled` + botao Cancelar no frontend.
- [x] Criar historico completo com filtros e pagina `/dashboard/history`.
- [x] Expandir filtros backend de QR para data e faixa de valor.
- [x] Criado AppController e mapeamento de rota raiz no backend para evitar erros 404 ao acessar a porta 3001 diretamente, guiando o desenvolvedor para a porta correta do Dashboard.
- [x] Corrigidos avisos de sintaxe do Tailwind CSS (`@tailwind` / `@apply`) no VS Code via configurações em `.vscode/settings.json`.
- [x] Geração da Estrutura do Monorepo.


- [x] Backend NestJS com WebSocket, SQLite e Entities.
- [x] Dashboard Next.js com TailwindCSS e Store Zustand.
- [x] Extensão Chrome V3 (Service Worker, Scanner JsQR, Content Script).
- [x] Implementação de deduplicação (Cache Local Extensão + Unique Hash DB).
- [x] Criação da Memória Técnica (`PROJECT_MASTER`).
- [x] AuditLogService — auditoria centralizada com filtros.
- [x] HealthController — observabilidade (GET /health e GET /health/ping).
- [x] WebhookModule — callback bancário com HMAC-SHA256.
- [x] AsaasPaymentAdapter — integração real com API Asaas Pix.
- [x] RequestIdMiddleware — rastreamento X-Request-Id.
- [x] Graceful Shutdown — SIGINT/SIGTERM + shutdown hooks.
- [x] CacheService — cache em memória com TTL.
- [x] data-source.ts — migrations CLI configurada.
- [x] Security hardening — helmet + compression.
- [x] AdapterFactory caching e logging de resolução.
- [x] **IPaymentAdapter expandido:** 10 métodos + ProviderMetadata.
- [x] **4 novos adapters:** MercadoPago, Inter, Efi, Banco do Brasil.
- [x] **AdapterFactory Registry Pattern:** lookup table com 7+ providers.
- [x] **BankAccountEntity:** credenciais criptografadas, isDefault, lastKnownBalance.
- [x] **FinancialReceiptEntity:** comprovantes com hash, formato, URL.
- [x] **PaymentWebhookEntity:** log completo de webhooks.
- [x] **EncryptionService:** AES-256-GCM com encrypt/decrypt.
- [x] **PaymentQueueService:** fila in-memory com retry, backoff, handlers.
- [x] **UserEntity expandido:** role, isActive, lastLoginAt, apiKeyRotatedAt.
- [x] **SQLite WAL mode:** journal_mode=WAL, synchronous=NORMAL, cache_size, busy_timeout.
- [x] **PostgreSQL pool:** poolSize, idleTimeout, connectionTimeout.
- [x] **MockAdapter reescrito:** full interface implementation.
- [x] **AsaasAdapter reescrito:** full interface implementation.
- [x] **.env.example expandido:** ENCRYPTION_KEY, MP_, INTER_, EFI_, BB_, DB_POOL_SIZE.
- [x] Corrigido backend runtime `MODULE_NOT_FOUND` (build emitindo `dist/main.js` + scripts).
- [x] Ajustado `@aios/shared` para buildar em `dist/` e expor `main/types` corretos.
- [x] Corrigidos erros de DI (imports/TypeOrmModule.forFeature) que impediam o backend de subir.
- [x] Corrigidos erros de TypeORM + SQLite por union types (colunas com `string | null` sem `type`).

## Espaço para Futuras Atualizações
*(Mova as tarefas conforme o progresso das sprints)*
