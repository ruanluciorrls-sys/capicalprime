# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copia arquivos de dependências
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/dashboard/package.json ./apps/dashboard/package.json

# Instala dependências
RUN npm ci --workspace=@aios/dashboard --workspace=@aios/shared --include-workspace-root

# Copia código fonte
COPY apps/dashboard/ ./apps/dashboard/

# Variáveis de build (substitua pela URL real do backend em produção)
ARG NEXT_PUBLIC_API_URL=https://api.seudominio.com
ARG NEXT_PUBLIC_WS_URL=wss://api.seudominio.com
# INTERNAL_API_URL: destino do proxy SSR (rewrites). O next.config.js avalia
# rewrites() em BUILD TIME e grava o destino no routes-manifest.json, por isso
# precisa existir aqui (não só em runtime). Aponta para o service Docker interno.
ARG INTERNAL_API_URL=http://backend:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL

# Build shared package
RUN npm run build --workspace=@aios/shared

# Build Next.js
RUN npm run build --workspace=@aios/dashboard

# ── Stage 2: Production ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

EXPOSE 3000

CMD ["node", "apps/dashboard/server.js"]
