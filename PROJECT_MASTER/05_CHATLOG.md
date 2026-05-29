# 05 - CHATLOG

**Objetivo:** Registrar as decisões evolutivas de desenvolvimento e discussões entre o Dev e a IA.

*(Adicione novos registros no TOPO da lista)*

---

[22/05/2026] — Enterprise Hardening Backend v1.1.0

**DECISÃO:**
Implementar 9 gaps críticos identificados na análise técnica do backend NestJS, versionar o monorepo para 1.1.0 e registrar todas as mudanças no CHANGELOG.

**MOTIVO:**
O backend possuía vulnerabilidades e lacunas que impediriam uma operação estável em produção: fila de pagamentos volátil (setTimeout), WebSocket sem throttle, extensões sem endpoint de revogação, synchronize=true em produção, e serviços referenciados mas sem implementação funcional (AuditLog, Encryption, Cache, Guards).

**RESULTADO:**
- `PaymentQueueService`: fila in-memory com retry exponencial, handlers registráveis e limpeza de timers no shutdown. `PaymentsService` refatorado para usar `onModuleInit` + `PaymentQueueService` eliminando os `setTimeout` voláteis.
- `WsThrottlerGuard`: rate limiting sobre conexões Socket.io, aplicado via `@UseGuards` no `QrGateway`.
- `ExtensionController` + `ExtensionService.revokeDevice()`: endpoint `DELETE /extension/devices/:deviceId` para revogação remota e segura de dispositivos Chrome.
- `DatabaseModule`: `synchronize` agora desativado automaticamente quando `NODE_ENV=production` (SQLite e PostgreSQL).
- Migration inicial `1716380000000-InitialSchema.ts` criada para produção.
- `AuditLogService` integrado nos pontos críticos: `QrService` (ingest, approve, reject) e `ExtensionService` (revokeDevice).
- `ENCRYPTION_KEY` de exemplo documentado no `.env.example`.
- `CHANGELOG.md` criado e preenchido com v1.1.0 completo.

**ARQUIVOS AFETADOS:**
- `apps/backend/src/modules/payments/payments.service.ts`
- `apps/backend/src/modules/payments/services/payment-queue.service.ts` *(já existia, integrado)*
- `apps/backend/src/common/guards/ws-throttler.guard.ts` *(criado)*
- `apps/backend/src/modules/qr/qr.gateway.ts`
- `apps/backend/src/modules/qr/qr.service.ts`
- `apps/backend/src/modules/qr/qr.module.ts`
- `apps/backend/src/modules/extension/extension.controller.ts`
- `apps/backend/src/modules/extension/extension.service.ts`
- `apps/backend/src/modules/extension/extension.module.ts`
- `apps/backend/src/database/database.module.ts`
- `apps/backend/src/database/migrations/1716380000000-InitialSchema.ts` *(criado)*
- `.env.example`
- `CHANGELOG.md`
- `package.json` (raiz) e `apps/dashboard/package.json` → v1.1.0

---

[21/05/2026]

**DECISÃO:**
Criar `AppController` na raiz do backend NestJS e excluir o caminho `/` do prefixo de rotas globais `/api/v1`.

**MOTIVO:**
Acessar `http://localhost:3001` (porta do backend) retornava um erro HTTP 404 (`Cannot GET /`) devido ao prefixo global, confundindo desenvolvedores que tentam verificar o funcionamento da API ou abrir o dashboard na porta errada.

**RESULTADO:**
Qualquer requisição GET ao root do backend (`http://localhost:3001/`) agora retorna um JSON amigável contendo informações sobre a API (estado, ambiente, versão) e links diretos para a verificação de saúde (`/api/v1/health`), `/api/v1/health/ping` e o endereço do Dashboard.

**ARQUIVOS AFETADOS:**
- `apps/backend/src/app.controller.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/main.ts`

---


[21/05/2026]

**DECISÃO:**
Configurar as diretrizes do VS Code (`.vscode/settings.json`) para silenciar os alertas de CSS desconhecido (`unknownAtRules`) e mapear arquivos CSS para o Tailwind CSS IntelliSense.

**MOTIVO:**
O editor exibia repetidos erros de sintaxe e avisos em `globals.css` devido ao uso de `@tailwind` e `@apply`, que não são regras CSS padrão.

**RESULTADO:**
Os alertas foram completamente eliminados do ambiente de desenvolvimento do VS Code. O build do dashboard foi executado com sucesso, sem impacto no código.

**ARQUIVOS AFETADOS:**
- `.vscode/settings.json`

---


[21/05/2026]

**DECISÃO:**
Padronizar Node LTS e corrigir pipeline de runtime do monorepo (Nest + Shared + Next).

**MOTIVO:**
O backend falhava em runtime com `MODULE_NOT_FOUND` ao tentar executar `apps/backend/dist/main`, e o dashboard emitia warning do Next/SWC relacionado a workspaces/lockfile.

**RESULTADO:**
- Backend: build passou a gerar `apps/backend/dist/main.js` e o `dev` voltou a subir.
- Shared: passou a expor `main/types` via `dist/`, evitando dependência direta em `index.ts`.
- Workspaces: `.npmrc` reforça `workspaces=true`; engines do root restringem Node a `>=20 <23`; `.nvmrc` fixado em `22.3.0`.

**ARQUIVOS AFETADOS:**
- `.nvmrc`, `.npmrc`, `package.json`
- `apps/backend/*` (tsconfig/scripts/módulos/entidades)
- `packages/shared/package.json`

---

[20/05/2026]

**DECISÃO:**
Geração da documentação detalhada da Arquitetura Backend Enterprise.

**MOTIVO:**
Necessidade de detalhar as implementações recentes de Enterprise Hardening (Multi-bank, Criptografia, Filas, WAL mode) para alinhar todo o time e futuras IAs sobre o fluxo completo do backend.

**RESULTADO:**
Documentação gerada explicando o uso do NestJS, Padrão Adapter (Registry), WebSockets, Webhooks com HMAC, e estratégias de segurança e escalabilidade.

**ARQUIVOS AFETADOS:**
- Chat context.

---

[20/05/2026]

**DECISÃO:**
Modelagem Completa do Sistema Multi-Bank + Database + Segurança + Filas

**MOTIVO:**
O sistema precisava nascer preparado para múltiplos bancos (Asaas, Mercado Pago, Inter, Efi, BB). O banco de dados precisava de modelo financeiro profissional (comprovantes, webhooks, contas bancárias criptografadas). A segurança exigia criptografia AES-256-GCM para dados sensíveis. As filas precisavam de abstração profissional com retry e handlers registráveis.

**RESULTADO:**
- IPaymentAdapter expandido: 10 métodos (pay, consultStatus, cancel, refund, getReceipt, validatePixKey, getBalance, getMetadata) + ProviderMetadata
- 4 novos adapters: MercadoPagoPaymentAdapter, InterPaymentAdapter, EfiPaymentAdapter, BancoDoBrasilPaymentAdapter
- AdapterFactory refatorado para Registry Pattern com lookup table + cache
- 3 novas entidades: BankAccountEntity (credenciais criptografadas + isDefault + lastKnownBalance), FinancialReceiptEntity (comprovantes com hash, formato, URL), PaymentWebhookEntity (log completo com assinatura, IP, status, latency)
- EncryptionService: AES-256-GCM com encrypt/decrypt/encryptObject/decryptObject
- PaymentQueueService: fila in-memory com 4 estados, retry exponencial, handlers registráveis
- UserEntity expandido: role, isActive, lastLoginAt, apiKeyRotatedAt, bankAccounts relation
- DatabaseModule: SQLite WAL mode (journal_mode, synchronous, cache_size, busy_timeout, foreign_keys), PostgreSQL pool (poolSize, timeout)
- MockPaymentAdapter reescrito: full interface implementation

---

[20/05/2026]

**DECISÃO:**
Enterprise Hardening Completo do Backend — criação de módulos faltantes para produção.

**MOTIVO:**
Após análise profunda da arquitetura, identificou-se 9 gaps críticos: ausência de auditoria centralizada, observabilidade (health check), webhook para callbacks bancários, adapter Asaas real, graceful shutdown, request tracing, cache em memória, migrations CLI, e segurança via helmet/compression.

**RESULTADO:**
- AuditLogService criado (escrita/consulta de logs de auditoria com filtragem por entidade, ação, ator)
- HealthController criado (endpoints GET /health e GET /health/ping com status DB, métricas de memória e latência)
- WebhookModule criado (POST /webhook/bank-callback com validação de assinatura HMAC-SHA256)
- AsaasPaymentAdapter criado (consumo real da API Asaas Pix via fetch com fallback e tratamento de erros)
- RequestIdMiddleware criado (X-Request-Id tracing em todas as requisições)
- Graceful Shutdown adicionado (SIGINT/SIGTERM + enableShutdownHooks)
- CacheService criado (in-memory TTL cache para queries frequentes)
- data-source.ts criado (DataSource CLI para typeorm migrations)
- AdapterFactory melhorado (cache de instâncias, logging de resolução)
- .env.example expandido (WEBHOOK_SECRET, ASAAS_API_KEY, WS_THROTTLE_*)
- package.json atualizado (compression, helmet)

---

[20/05/2026]

**DECISÃO:**
Definição da Arquitetura Backend Enterprise (NestJS, Modular, WebSocket, Adapter Pattern).

**MOTIVO:**
Estruturar o servidor para lidar com alta concorrência de requisições de extensões, garantindo a integridade dos dados (deduplicação) e a comunicação bidirecional realtime sem gargalos, preparando para o futuro scale no PostgreSQL.

**RESULTADO:**
Estrutura modular do NestJS consolidada (Qr, Payment, Auth, Extension, Ws), fluxo de aprovação manual modelado, e mecanismos de segurança (JWT/API Keys) definidos.

**ARQUIVOS AFETADOS:**
- Módulo Backend (`apps/backend/`)

---

[20/05/2026]

**DECISÃO:**
Definição completa da Arquitetura Frontend (Dark Mode, Tailwind, Zustand, Realtime).

**MOTIVO:**
Necessidade de estabelecer um padrão robusto, responsivo e moderno para o Dashboard do QR PIX MANAGER antes da implementação pesada dos componentes visuais.

**RESULTADO:**
Estrutura de pastas Next.js, design system baseado em Tailwind, gerenciamento de estado via Zustand e arquitetura de componentes definidos.

**ARQUIVOS AFETADOS:**
- Módulo Frontend (`apps/dashboard/`)

---

[20/05/2026]

**DECISÃO:**
Geração contínua de metadados no final de cada resposta.

**MOTIVO:**
Manter a memória do projeto perfeitamente sincronizada e garantir que nenhuma alteração arquitetural ou de status passe despercebida pela IA em interações futuras.

**RESULTADO:**
Sempre que uma resposta técnica for finalizada, um bloco "ATUALIZAÇÃO PARA PROJECT_MASTER" será gerado no final do chat detalhando exatamente o que deve ser atualizado nos arquivos de estado.

**ARQUIVOS AFETADOS:**
- Padrão de comunicação do agente.

---

[20/05/2026]

**DECISÃO:**
Uso do padrão Adapter para o módulo de pagamentos.

**MOTIVO:**
O projeto determina o uso inicial da API Asaas, mas exige preparação estrutural para outros bancos (Sicoob, Itaú, Bradesco). O padrão Adapter isola as regras do banco do fluxo central de orquestração.

**RESULTADO:**
Qualquer novo banco pode ser adicionado criando uma classe que implemente a interface `IPaymentAdapter` sem alterar o serviço principal `PaymentsService`.

**ARQUIVOS AFETADOS:**
- `apps/backend/src/modules/payments/adapters/`
- `apps/backend/src/modules/payments/payments.service.ts`

---

[20/05/2026]

**DECISÃO:**
Criação dos arquivos de Memória Técnica (PROJECT_MASTER).

**MOTIVO:**
Solicitação direta para estruturar a documentação de continuidade e contexto do projeto para IAs.

**RESULTADO:**
Dez arquivos Markdown criados na raiz para alinhar qualquer agente futuro sobre o estado e regras do projeto.

**ARQUIVOS AFETADOS:**
- `/PROJECT_MASTER/*.md`
