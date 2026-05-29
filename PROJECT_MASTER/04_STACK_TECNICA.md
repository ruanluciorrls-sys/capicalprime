# 04 - STACK TÉCNICA

**Objetivo:** Relacionar as tecnologias oficiais adotadas no projeto para manter consistência nas implementações.

## Frontend (Dashboard)
- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** TailwindCSS + Variáveis CSS Nativas (Design System)
- **Estado Global:** Zustand + Immer
- **Tempo Real:** Socket.io-client
- **Ícones:** Lucide React

## Backend (API & WebSocket Server)
- **Framework:** NestJS 10
- **Linguagem:** TypeScript
- **Banco de Dados (ORM):** TypeORM
- **Banco de Dados (Engine):** SQLite (Dev) / PostgreSQL (Prod)
- **Tempo Real:** Socket.io (@nestjs/platform-socket.io)
- **Gerenciamento de Eventos:** @nestjs/event-emitter
- **Validação:** class-validator & class-transformer

## Chrome Extension
- **Manifest:** Version 3
- **Linguagem:** TypeScript
- **Bundler:** Vite
- **Leitura de QR Code:** jsQR
- **Comunicação Background:** Service Workers + Alarms (Keep-alive)

## Tooling / Monorepo
- **Gerenciador de Pacotes:** npm
- **Monorepo Engine:** Turborepo
- **Tipagem Comum:** Pacote local `@aios/shared`

## Integrações
- **Pagamentos (Inicial):** Asaas API

## Espaço para Futuras Atualizações
*(Atualize as versões das bibliotecas core e adicione novas ferramentas de devops, logging e monitoramento)*
