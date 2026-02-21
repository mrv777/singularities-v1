FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy package.json files for all packages
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

# Build shared then server
RUN pnpm --filter @singularities/shared build
RUN pnpm --filter @singularities/server build

# Copy SQL migration files (tsc doesn't copy non-TS assets)
RUN cp -r packages/server/src/db/migrations packages/server/dist/db/migrations

EXPOSE 3001

# Run migrations then start
CMD node packages/server/dist/db/migrate.js && node packages/server/dist/index.js
