# Singularities (AI Game v2)

Competitive cyberpunk idle/strategy game with server-authoritative PvE + PvP systems, on-chain VRF resolution, and NFT-backed player identities on Solana.

## Stack

- **Monorepo**: `packages/shared`, `packages/server`, `packages/client`, `packages/chain`
- **Server**: Fastify + PostgreSQL + Redis
- **Client**: React + TanStack Router + Zustand + Vite
- **Chain**: Anchor (Solana) + MagicBlock Ephemeral Rollups + VRF
- **NFT**: Metaplex MPL-Core for player identity NFTs
- **Build**: `pnpm`

## Solana Integration

### On-Chain VRF (Provably Fair Hack Resolution)

Hack outcomes use MagicBlock's Verifiable Random Function for provably fair randomness. The Anchor program (`packages/chain/`) runs on Solana devnet.

**Flow**: Server initiates hack PDA → delegates to Ephemeral Rollup → requests VRF randomness → oracle callback resolves outcome on-chain → server reads result and applies it.

When `CHAIN_RESOLUTION_ENABLED=true`, detection rolls, damage values, and system shuffles are derived from on-chain VRF. When disabled, the server falls back to local RNG. Game results show an "On-Chain Verified" badge linking to Solana Explorer when VRF is active.

**Program ID**: `A6Jmogct56jdyd7MGygTSvzu7f4eJgYSXiTAGBaDGw4S` (devnet)

### NFT Player Identity

Each player mints an MPL-Core NFT during registration. The NFT represents the player's AI identity and is burned on death.

- **Minting**: Two-step flow — server builds partially-signed tx, player signs in wallet, server submits
- **Transfer detection**: Background worker checks NFT ownership and updates wallet if transferred (48h adaptation period)
- **Death/burn**: Server burns NFT via BurnDelegate plugin; failed burns queued for retry
- **Metadata**: Dynamic endpoint serves NFT metadata and images for wallets/explorers

### Wallet Authentication

Players connect via Phantom or Solflare. Authentication uses challenge-response message signing (not transaction signing) to issue JWT tokens.

### Environment Variables (Solana)

```bash
# Solana RPC
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# On-chain VRF resolution
CHAIN_RESOLUTION_ENABLED=true
PROGRAM_ID=A6Jmogct56jdyd7MGygTSvzu7f4eJgYSXiTAGBaDGw4S
SERVER_KEYPAIR_PATH=./server-keypair.json
MAGICBLOCK_ROUTER_URL=https://devnet-router.magicblock.app

# NFT Minting
TREASURY_WALLET_ADDRESS=<receives mint payments>
TREASURY_KEYPAIR_PATH=./treasury-keypair.json
MINT_PRICE_USD=10
NFT_METADATA_BASE_URL=https://singularities.world

# Client (Vite VITE_ prefix)
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_NETWORK=devnet
```

### Building the Anchor Program

```bash
cd packages/chain
anchor build
anchor deploy --provider.cluster devnet
```

Requires Solana CLI, Anchor CLI 0.32.1, and Rust toolchain.

## Admin Setup

Set these env vars on the server:

```bash
ADMIN_ENABLED=true
ADMIN_PLAYER_IDS=<comma-separated-player-uuid-list>
ADMIN_WALLET_ADDRESSES=<comma-separated-wallet-addresses>
```

Security model:

- Admin APIs are disabled unless `ADMIN_ENABLED=true`.
- Admin access is allowlist-based (player ID and/or wallet address).
- Admin middleware verifies JWT wallet matches the player's current wallet in DB.
- High-risk action (`POST /api/admin/season/end`) requires explicit confirmation text (`END SEASON`).
- Admin writes are recorded in `admin_audit_logs`.

## Arena Bot System

Bots are **synthetic opponents**, not entries in the `players` table.

Guardrails:

- Backfill only when human opponent list is below floor.
- Daily bot-attack cap per player.
- Reduced bot rewards and **0 reputation gain** from bot fights.
- Bot matches are marked (`is_bot_match=true`) and excluded from competitive aggregate metrics.
- Runtime toggle via admin endpoint (`POST /api/admin/bots/enabled`).

## Docs

- `docs/ARENA_BOTS.md`
- `docs/ADMIN_CONSOLE.md`

## Verification Commands

```bash
pnpm --filter @singularities/server run db:migrate
pnpm -r typecheck
pnpm --filter @singularities/server test
pnpm --filter @singularities/server sim:bots -- --runs=3000 --days=7 --seed=1337
```
