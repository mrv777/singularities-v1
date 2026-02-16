# Singularities — Developer Notes

## Stack
- Monorepo: `packages/shared`, `packages/server`, `packages/client`
- Server: Fastify + PostgreSQL + Redis (Docker containers: `ai-game-v2-postgres-1`, `ai-game-v2-redis-1`)
- Client: React + TanStack Router + Zustand + Vite
- Build: `pnpm`

## Dev Servers
- Server: `pnpm --filter @singularities/server run dev` → http://localhost:3001
- Client: `pnpm --filter @singularities/client run dev` → http://localhost:5173 (or next available port)
- Migrations: `pnpm --filter @singularities/server run db:migrate`

## DB Access
```bash
docker exec ai-game-v2-postgres-1 psql -U singularities -d singularities -c "YOUR SQL HERE"
```

## Test Auth Token
JWT secret (dev): `change-me-in-production` (dotenv loads from `packages/server` CWD, root `.env` is NOT picked up by dotenv).

Generate a test token for player 1:
```bash
node -e "
const fastjwt = require('$(find node_modules/.pnpm -path '*/fast-jwt/src/index.js' | head -1)');
const signer = fastjwt.createSigner({ key: 'change-me-in-production', expiresIn: 604800000 });
console.log(signer({ sub: '38847a5b-1f1d-447a-bcba-55f7b9adcd26', wallet: '8fohEaQfWf4XG9LcXjk3ZBarxqH377nwiBtsUBDt2SDt' }));
"
```

Example curl:
```bash
T="<token>" && curl -s -H "Authorization: Bearer $T" http://localhost:3001/api/player/me | python3 -m json.tool
```
