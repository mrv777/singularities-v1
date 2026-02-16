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
} as const;
