# 00 - ESTADO DO PROJETO

**Objetivo:** Resumir o estado atual do projeto para rápida contextualização de qualquer IA ou desenvolvedor.

## Informações Atuais
- **Nome do Projeto:** AI PROJECT OPERATING SYSTEM / QR PIX MANAGER
- **Fase Atual:** MVP / Fundação + Enterprise Hardening (Local-first)
- **Data da Última Atualização:** 22/05/2026

## Atualização Recente (Runtime)
- **Core Fixes (v2.1.0):** Corrigidos registro automatico da extensao com API Key embutida no ZIP, heartbeat por `chrome.alarms`, endpoint de saldo Asaas com validacao de credencial, persistencia de `bankConfig`, seed idempotente do usuario default e template de extensao em `templates/extension` com placeholders substituidos pelo backend.
- **Extensoes Realtime (v1.5.0):** Implementado heartbeat de extensao, status ONLINE/OFFLINE/ERROR com lastSeen/lastError no backend, eventos websocket `extension.status.update`, painel de extensoes no dashboard com revogacao e sincronizacao em tempo real, botao de teste funcional e notificacoes no popup da extensao.
- **Frontend Redesign (v1.3.0):** Finalizado tema visual completo do Dashboard com tema dark-mode/azul primário, glassmorphism, sombras neon/glow, WebSocket toasts interativos com `react-hot-toast`, e compilação do Tailwind CSS corrigida pela adição do `postcss.config.js`.
- Backend voltou a subir em `dev`: corrigido o erro `MODULE_NOT_FOUND` causado por build emitindo fora de `dist/main.js`.
- Padronização do pacote `@aios/shared` para buildar em `dist/` e ser consumido via `main/types` (evita importar TS source do workspace em runtime).
- Ajuste de compatibilidade de Node: recomendado Node LTS `22.3.0` (engines `>=20 <23`).
- NPM workspaces forçado via `.npmrc` para evitar warning/erro do Next/SWC relacionado a lockfile/workspaces.
- Criado arquivo de configurações globais `.vscode/settings.json` para suprimir alertas de lint de regras customizadas do Tailwind CSS (`@tailwind`, `@apply`).
- Adicionado `AppController` na raiz do backend (excluindo `/` do prefixo de API `/api/v1`) para evitar erros 404 ao acessar `http://localhost:3001` diretamente, fornecendo orientações de caminhos corretos e links da API e do Dashboard.


## Progresso Atual
- [x] Estruturação do Monorepo (Turborepo)
- [x] Configuração do Backend (NestJS + TypeORM + SQLite + WebSocket)
- [x] Configuração do Frontend (Next.js + TailwindCSS + Zustand + Socket.io)
- [x] Configuração da Extensão Chrome (Manifest V3 + jsQR)
- [x] Implementação de tipos e utilitários compartilhados (Parser Pix)
- [x] Geração e Manutenção da Memória Técnica do Projeto
- [x] Fundamentação da Arquitetura Enterprise (Event-Driven e Padrão Adapter)
- [x] Definição da Arquitetura Frontend Avançada (UI/UX, Realtime, Zustand)
- [x] Definição da Arquitetura Backend Avançada (NestJS, Event-Driven, WebSocket)
- [x] Documentação consolidada da Arquitetura Backend Enterprise (Multi-Bank, Filas, Criptografia)
- [x] **Enterprise Hardening:** AuditLogService (auditoria centralizada)
- [x] **Enterprise Hardening:** HealthController (observabilidade)
- [x] **Enterprise Hardening:** WebhookController (callbacks bancários)
- [x] **Enterprise Hardening:** AsaasAdapter (adapter de pagamento real)
- [x] **Enterprise Hardening:** Graceful Shutdown + RequestIdMiddleware
- [x] **Enterprise Hardening:** CacheService (cache em memória)
- [x] **Enterprise Hardening:** data-source.ts (migrations CLI)
- [x] **Enterprise Hardening:** Security headers (helmet) + compression
- [x] **Enterprise Hardening:** Merchant/Bank Account entities + webhook secret validation

## Progresso Atual (continuação)
- [x] **Multi-Bank Architecture:** Interface IPaymentAdapter expandida com 10 métodos (pay, consultStatus, cancel, refund, getReceipt, validatePixKey, getBalance, getMetadata)
- [x] **Multi-Bank Architecture:** Adapters criados para Asaas, Mercado Pago, Banco Inter, Efi/Gerencianet, Banco do Brasil, Sicoob
- [x] **Multi-Bank Architecture:** Registry Pattern no AdapterFactory com suporte a 7+ providers
- [x] **Database Modelagem:** BankAccountEntity (credenciais criptografadas por provider)
- [x] **Database Modelagem:** FinancialReceiptEntity (comprovantes de pagamento)
- [x] **Database Modelagem:** PaymentWebhookEntity (log de todos os webhooks recebidos)
- [x] **Database Modelagem:** SQLite WAL mode ativado (journal_mode, synchronous, cache_size, busy_timeout)
- [x] **Database Modelagem:** PostgreSQL pool configurado (poolSize, idleTimeout, connectionTimeout)
- [x] **Database Modelagem:** UserEntity expandido (role, isActive, lastLoginAt, apiKeyRotatedAt, bankAccounts)
- [x] **Segurança:** EncryptionService (AES-256-GCM para criptografia de credenciais bancárias)
- [x] **Segurança:** ENCRYPTION_KEY no .env com geração automática de fallback
- [x] **Filas:** PaymentQueueService (abstração de fila in-memory com retry, exponential backoff, handlers)
- [x] **Filas:** Sistema de jobs com tipos, tentativas, handlers registráveis
- [x] **Observabilidade:** ProviderMetadata em cada adapter (features suportadas, limites, ambiente)
- [x] **Extensao:** Heartbeat periodico e status de conexao persistidos em `extension_devices`
- [x] **Extensao:** Botao de teste envia QR simulado para fila do dashboard
- [x] **Dashboard:** Painel de extensoes com status realtime e revogacao de dispositivo

## Próximos Passos Imediatos
- Criar testes unitários e de integração (Jest) para adapters multi-banco.
- Migrar retry de setTimeout para PaymentQueueService.
- Configurar Redis para fila de pagamentos (Bull) e pub/sub de WebSocket.
- Deploy em container Docker com PostgreSQL.
- Implementar refresh token e rotação de API Keys.
- Testar fluxo completo: Extensão → Ingest → Aprovação → Asaas → Webhook → Dashboard.

## Espaço para Futuras Atualizações
*(Adicione resumos de grandes marcos ou refatorações estruturais aqui)*
