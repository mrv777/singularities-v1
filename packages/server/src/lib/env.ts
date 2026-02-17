import "dotenv/config";

export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://singularities:singularities@localhost:5432/singularities",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  SOLANA_RPC_URL:
    process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  SOLANA_NETWORK: process.env.SOLANA_NETWORK ?? "devnet",
  JWT_SECRET: process.env.JWT_SECRET ?? "change-me-in-production",
  PORT: Number(process.env.PORT ?? 3001),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  MAGICBLOCK_ROUTER_URL:
    process.env.MAGICBLOCK_ROUTER_URL ??
    "https://devnet-router.magicblock.app",
  CHAIN_RESOLUTION_ENABLED: process.env.CHAIN_RESOLUTION_ENABLED === "true",
  PROGRAM_ID: process.env.PROGRAM_ID ?? "",
  SERVER_KEYPAIR_PATH:
    process.env.SERVER_KEYPAIR_PATH ?? "./server-keypair.json",
} as const;
