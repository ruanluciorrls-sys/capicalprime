# 99 - DECISÕES TÉCNICAS

**Objetivo:** Registrar as decisões base da arquitetura que NÃO DEVEM ser alteradas de forma leviana sem aprovação arquitetural rigorosa.

1. **Local-first (SQLite):** O sistema foi planejado para rodar primeiramente na máquina local do cliente, logo usamos SQLite configurado no TypeORM. O TypeORM foi escolhido pois basta uma troca de variável `.env` (`DATABASE_TYPE=postgres`) para portar a solução para a nuvem. Não usar raw SQL preso a dialetos locais.
2. **WebSocket Singleton no Next.js:** Há apenas uma instância de `socket.io-client` compartilhada em toda a árvore do React (via hook `useWebSocket`) para não inundar o servidor NestJS com reconexões devido a renderizações.
3. **Padrão Adapter para Bancos:** Nenhum Service deve ter lógicas específicas de "Banco A" ou "Banco B". Tudo deve passar pela interface `IPaymentAdapter`. Se precisar trocar o Asaas por Sicoob, cria-se a classe `SicoobAdapter`, registra na `PaymentAdapterFactory`, e o core continua intacto.
4. **Hashing Criptográfico de Deduplicação:** Extensões sofrem de "loop trigger" (acionamentos múltiplos). A deduplicação usa estritamente o algoritmo SHA-256 no Frontend da extensão antes de consumir a rede, em conjunto com bloqueio transacional (UNIQUE constraint) no banco.
5. **Comunicação por Eventos (Event-driven):** Módulos não se chamam diretamente quando há efeitos colaterais grandes. Exemplo: O `QrService` não chama o `PaymentService`. Ele emite um evento (`EventBus`), garantindo baixo acoplamento.
6. **State Management no Frontend (Zustand):** Escolhido sobre Redux/Context puro devido a sua reatividade cirúrgica, falta de boilerplate e excelente integração com fluxos de Socket.io (dispensa providers complexos e previne re-renderizações desnecessárias).
7. **Design System Frontend (Tailwind CSS + Dark Theme):** Adotada uma abordagem de Glassmorphism e Dark Mode nativo visando alto apelo visual (Premium UX). Tailwind escolhido para manter o bundle reduzido e facilitar a responsividade granular sem depender de bibliotecas pesadas.
8. **Arquitetura Modular Backend (NestJS):** Divisão estrita de domínios. Módulo QR cuida da validação PIX, Módulo de Pagamentos cuida de transações e Adapters. Comunicação entre domínios sempre através de `EventEmitter2` interno (CQRS simplificado).
9. **Gerenciamento de Websocket:** Gateway concentrado e validado. O cliente web se autentica no socket usando JWT, garantindo que eventos sensíveis não vazem.

10. **Auditoria Centralizada (AuditLogService):** Toda ação de impacto (criação, aprovação, rejeição, pagamento, alteração de config) DEVE ser registrada via AuditLogService. Isso garante rastreabilidade completa para compliance e debugging. O serviço é global (provido pelo AppModule) e injetável em qualquer módulo.
11. **Webhook com HMAC-SHA256:** Callbacks bancários chegam via POST /webhook/bank-callback. A autenticação é feita via HMAC-SHA256 do body com a chave WEBHOOK_SECRET. O banco deve assinar a requisição com o header `x-webhook-signature`.
12. **Cache em Memória com TTL (CacheService):** Para dados de alta leitura e baixa escrita (ex: stats do dashboard), usa-se cache local com TTL de 30s. NÃO USAR para dados sensíveis ou que exigem consistência imediata. Futuramente substituir por Redis.
13. **Graceful Shutdown e Request Tracing:** O servidor escuta SIGINT/SIGTERM para fechar conexões de forma segura (evita corrupção de dados SQLite). Cada requisição recebe um X-Request-Id (UUID v4) para rastreabilidade em logs.
14. **Two-layer Security:** A API tem duas camadas de autenticação: (1) ApiKeyGuard para Dashboard (via header X-Api-Key), (2) DeviceTokenGuard para Extensão (via JWT Bearer token). WebSocket também requer autenticação JWT na conexão (query param `apiKey` ou `auth.token`).

15. **Interface Bancária Completa (IPaymentAdapter):** A interface define 10 métodos obrigatórios/opcionais: pay, consultStatus, cancel, refund, getReceipt, validatePixKey, getBalance, getMetadata. Cada provider declara via `getMetadata()` quais features suporta, permitindo que o dashboard desabilite botões não suportados dinamicamente.
16. **Registry Pattern para Adapters:** Substituiu o switch-case manual por ADAPTER_REGISTRY (Record<string, AdapterConstructor>). Novo banco = 1 linha no registro. Zero impacto no código de resolução. Factory também cacheia instâncias stateless.
17. **Criptografia AES-256-GCM para Dados Sensíveis:** Credenciais bancárias NUNCA são armazenadas em plain text. O EncryptionService usa AES-256-GCM com IV aleatório por encryptação e authentication tag. ENCRYPTION_KEY é definida no .env. Se ausente, gera chave efêmera com warning (apenas para dev).
18. **Contas Bancárias Separadas por Provider:** BankAccountEntity substitui o campo genérico bank_config. Cada conta tem: provider, label, encryptedCredentials, environment (sandbox/production), isDefault, lastKnownBalance, lastSyncAt. Um usuário pode ter múltiplas contas do mesmo banco (ex: produção + sandbox).
19. **Comprovantes Financeiros Estruturados:** FinancialReceiptEntity armazena comprovantes de pagamento com: receiptUrl, receiptData (base64), parsedData (JSON), contentHash (SHA-256), mimeType, fileSizeBytes. Suporta 3 tipos: BANK_PROVIDED, SYSTEM_GENERATED, MANUAL_UPLOAD.
20. **Log Profissional de Webhooks:** PaymentWebhookEntity registra TODO webhook recebido com: rawBody (preservado), parsedBody, signature, signatureValid, ipAddress, processingTimeMs, status (RECEIVED/PROCESSED/FAILED/IGNORED). Essencial para debugging de integrações bancárias.
21. **Fila de Pagamentos com Retry Inteligente:** PaymentQueueService abstrai o conceito de fila com: 4 estados (pending/processing/completed/failed), maxAttempts configurável, exponential backoff (1s, 2s, 4s, 8s... até 60s max), handler registration pattern. Futuramente substituído por Bull+Redis mantendo a mesma interface.
22. **SQLite WAL Mode Obrigatório:** DatabaseModule ativa PRAGMA WAL (Write-Ahead Logging) para permitir leitura concorrente durante escritas. Configurações: synchronous=NORMAL (segurança + performance), cache_size=20MB, busy_timeout=5s, foreign_keys=ON. Sem WAL, o SQLite trava em cenários de múltiplos QR simultâneos.

23. **Node LTS e Engines Fixas:** O monorepo deve rodar em Node LTS (preferência: 22.3.0). `engines.node` no root deve restringir para `>=20 <23`.
24. **Packages Compartilhados Sempre Buildados:** Workspaces compartilhados (ex: `@aios/shared`) devem expor `main/types` apontando para artefatos em `dist/` (nunca `index.ts` em runtime).
25. **TypeORM + Union Types:** Qualquer coluna com union (ex: `string | null`) deve declarar explicitamente `type` no `@Column`, para evitar inferência como `Object` em SQLite.
26. **Linting de CSS com at-rules customizadas (Tailwind):** Ignorar at-rules desconhecidas no analisador de CSS padrão do editor para evitar alertas visuais de regras como `@tailwind` e `@apply`, associando os arquivos `.css` à sintaxe do Tailwind CSS nas configurações do workspace.

## Espaço para Futuras Atualizações
*(Registre as próximas decisões arquiteturais vitais aqui)*
