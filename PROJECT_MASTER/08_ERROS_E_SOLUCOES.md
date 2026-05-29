# 08 - ERROS E SOLUÇÕES

**Objetivo:** Catalogar dores de cabeça conhecidas e suas resoluções para economizar tempo de debug.

## Erros Conhecidos

### VS Code: Aviso de regra desconhecida em CSS do Tailwind CSS (@tailwind / @apply)
**Sintoma:** Alertas de sintaxe `"Unknown at rule @tailwind"` e `"Unknown at rule @apply"` no editor ao editar `globals.css`.
**Causa:** O analisador CSS padrão do VS Code não reconhece as diretivas especiais do Tailwind.
**Solução (Implementada):** 
- Criar/editar o arquivo `.vscode/settings.json` na raiz do projeto.
- Adicionar `"css.lint.unknownAtRules": "ignore"` e `"scss.lint.unknownAtRules": "ignore"`.
- Adicionar a associação `"files.associations": { "*.css": "tailwindcss" }` para mapear o CSS para o processador do Tailwind CSS.

### Backend: MODULE_NOT_FOUND ao executar dist/main
**Sintoma:** `Error: Cannot find module '.../apps/backend/dist/main' (requireStack: [])`.
**Causa:** O build do backend não estava emitindo `dist/main.js` (saía com estrutura de pastas diferente) e o Nest executa `node dist/main` no `nest start --watch`.
**Solução (Implementada):**
- `apps/backend/tsconfig.json`: `rootDir=./src` e remoção de `paths` para TS source do `@aios/shared`.
- `packages/shared/package.json`: `main/types` apontando para `dist/` (consumo via build, não via `index.ts`).
- `apps/backend/package.json`: `start` passou a usar `node dist/main.js`.

### TypeORM + SQLite: DataTypeNotSupportedError (Object) em colunas union
**Sintoma:** `DataTypeNotSupportedError: Data type "Object" in "<Entity>.<prop>" is not supported by "better-sqlite3"`.
**Causa:** Com `emitDecoratorMetadata`, union types (ex: `string | null`) viram `Object` em runtime; se a coluna não declara `type`, o TypeORM tenta inferir e falha.
**Solução (Implementada):** Declarar explicitamente `type: 'varchar'` (ou outro tipo apropriado) em colunas union.

### SQLite Database is Locked (Prevenção de Alta Concorrência)
**Sintoma:** Ao receber dezenas de QR Codes simultâneos da extensão, o SQLite retorna erro "database is locked".
**Causa:** O SQLite possui limitações no nível de concorrência de escritas (lock no arquivo).
**Solução (Arquitetural):** Ativar o modo WAL (Write-Ahead Logging) no TypeORM/SQLite (`PRAGMA journal_mode=WAL;`) e utilizar fila/buffer local na memória ou RabbitMQ/Redis futuro para escritas em batch se o limite for excedido.

### Hydration Mismatch no Next.js com Zustand (Prevenção)
**Sintoma:** O Next.js acusa que a árvore de componentes renderizada no Server-Side não bate com a do Client-Side devido ao Zustand.
**Causa:** Lojas (stores) acessadas antes da hidratação completa no Client-side.
**Solução (Arquitetural):** Criar um hook customizado `useHydratedStore` que apenas renderiza o conteúdo do store após o `useEffect` (componentDidMount), garantindo o CSR (Client-Side Rendering) seguro para dados realtime.

### 1. Desconexão do Service Worker da Extensão (Manifest V3)
**Sintoma:** O WebSocket cai porque o Service Worker é inativado automaticamente pelo Chrome após 5 minutos.
**Causa:** Restrição arquitetural do Manifest V3 (não há processos background rodando eternamente).
**Solução (Implementada):** Uso de `chrome.alarms` no arquivo `service-worker.ts` configurado para rodar a cada 30 segundos chamando a API de `/heartbeat` para manter o SW ativo e o socket aberto.

### 2. QR Codes Lidos Múltiplas Vezes na Mesma Tela
**Sintoma:** Um único QR Code aparece na tela e a extensão dispara o evento de captura 20 vezes.
**Causa:** `MutationObserver` é reativo e a página re-renderiza várias vezes; ou o mesmo canvas é re-desenhado no DOM.
**Solução (Implementada):**
1. Na Extensão (`qr-detector.ts`): WeakSet para armazenar elementos já escaneados.
2. Na Extensão (`qr-dedup.ts`): Store local `chrome.storage` com os hashes SHA-256 processados.
3. No Backend: O campo `payload_hash` possui `UNIQUE CONSTRAINT` no banco. Retorna `409 Conflict`.

### 3. Retry com setTimeout não persiste entre reinicializações
**Sintoma:** Se o servidor reiniciar durante um retry de pagamento agendado com `setTimeout`, o pagamento fica "perdido" em status PENDING/PROCESSING.
**Causa:** `setTimeout` é volátil — não sobrevive a restart do processo.
**Solução (Futura):** Substituir por Bull/Redis queue. O Redis mantém o job mesmo com restart. Enquanto isso, um script de startup pode buscar payments com status PROCESSING e re-tentar.

### 4. WebSocket sem throttle abre porta para flood de mensagens
**Sintoma:** Um cliente malicioso ou mal-comportado pode emitir centenas de eventos por segundo no WebSocket, sobrecarregando o servidor.
**Causa:** Nenhum rate limiting no Gateway WebSocket.
**Solução (Pendente):** Implementar WsThrottlerGuard com @nestjs/throttler ou middleware customizado de rate limit por socketId.

### 5. Asaas API Key exposta em bank_config do usuário
**Sintoma:** A chave da API Asaas é armazenada em plain text na coluna `bank_config` do usuário.
**Causa:** Ausência de criptografia em repouso para dados sensíveis.
**Solução (Implementada):** EncryptionService com AES-256-GCM. BankAccountEntity armazena `encrypted_credentials` como texto criptografado. A chave mestra vem de ENCRYPTION_KEY no .env. Descriptografia ocorre apenas no resolution do adapter via factory, nunca exposta em logs.

### 6. SQLite sem WAL mode trava em alta concorrência
**Sintoma:** "SQLITE_BUSY: database is locked" ao receber múltiplos QR Codes simultâneos.
**Causa:** SQLite default journal mode (DELETE) bloqueia leituras durante escritas.
**Solução (Implementada):** WAL mode ativado via PRAGMA no DatabaseModule: journal_mode=WAL, synchronous=NORMAL, cache_size=-20000 (20MB), busy_timeout=5000ms, foreign_keys=ON.

### 7. Adapter Factory precisava de registro central de providers
**Sintoma:** A cada novo banco, um novo case precisava ser adicionado no switch do factory.
**Causa:** Factory implementado com switch-case manual.
**Solução (Implementada):** Registry Pattern com ADAPTER_REGISTRY (objeto chave-valor). Novo banco = uma linha no registro. Sem switch, sem modificação na lógica de resolução.

### 8. Credenciais bancárias expostas em plain text no banco
**Sintoma:** API Keys e tokens de banco salvos como JSON no campo bank_config do UserEntity.
**Causa:** TypeORM simple-json salva como string JSON sem criptografia.
**Solução (Implementada):** EncryptionService com AES-256-GCM. BankAccountEntity separa credenciais criptografadas em coluna própria. UserEntity.bankConfig mantido apenas para dados não sensíveis.

## Espaço para Futuras Atualizações
*(Registre logs de crash de produção e resoluções)*
