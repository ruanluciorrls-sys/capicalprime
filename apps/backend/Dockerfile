# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências de build
RUN apk add --no-cache python3 make g++

# Copia arquivos de dependências do monorepo
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copia packages compartilhados
COPY packages/ ./packages/

# Copia o backend
COPY apps/backend/package.json ./apps/backend/package.json

# Instala todas as dependências
RUN npm ci --workspace=@aios/backend --workspace=@aios/shared --include-workspace-root

# Copia o código fonte
COPY apps/backend/ ./apps/backend/

# Build shared package
RUN npm run build --workspace=@aios/shared

# Build
RUN npm run build --workspace=@aios/backend

# ── Stage 2: Production ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Dependências de runtime nativas (pg, bcrypt)
RUN apk add --no-cache python3 make g++

# Copia package files
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/backend/package.json ./apps/backend/package.json

# Instala apenas dependências de produção
RUN npm ci --workspace=@aios/backend --workspace=@aios/shared --include-workspace-root --omit=dev

# Copia o build gerado
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Copia templates da extensão (lidos em runtime para gerar o ZIP)
COPY apps/backend/templates ./apps/backend/templates

# Cria diretório de dados (para SQLite fallback)
RUN mkdir -p ./apps/backend/data

EXPOSE 3001

CMD ["node", "apps/backend/dist/main.js"]
