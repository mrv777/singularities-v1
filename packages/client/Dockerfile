FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy package.json files for all packages
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/client/ packages/client/

# Client env vars (baked into the Vite build via .env at envDir root)
ARG VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
ARG VITE_SOLANA_NETWORK=devnet
RUN printf "VITE_SOLANA_RPC_URL=%s\nVITE_SOLANA_NETWORK=%s\n" \
  "$VITE_SOLANA_RPC_URL" "$VITE_SOLANA_NETWORK" > .env

# Build shared then client
RUN pnpm --filter @singularities/shared build
RUN pnpm --filter @singularities/client build

FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
