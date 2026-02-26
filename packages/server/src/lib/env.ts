import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const candidateEnvPaths = [
  process.env.DOTENV_CONFIG_PATH,
  path.resolve(process.cwd(), ".env"),
  path.resolve(repoRoot, ".env"),
].filter((p): p is string => Boolean(p));

for (const envPath of candidateEnvPaths) {
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath });
  break;
}

export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://singularities:singularities@localhost:5432/singularities",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  SOLANA_RPC_URL:
    process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
  SOLANA_NETWORK: process.env.SOLANA_NETWORK ?? "mainnet-beta",
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
  TREASURY_WALLET_ADDRESS: process.env.TREASURY_WALLET_ADDRESS ?? "",
  COLLECTION_ADDRESS: process.env.COLLECTION_ADDRESS ?? "",
  MINT_PRICE_USD: Number(process.env.MINT_PRICE_USD ?? 10),
  NFT_METADATA_BASE_URL:
    process.env.NFT_METADATA_BASE_URL ?? "http://localhost:3001",
  ADMIN_ENABLED: process.env.ADMIN_ENABLED === "true",
  ADMIN_PLAYER_IDS: process.env.ADMIN_PLAYER_IDS ?? "",
  ADMIN_WALLET_ADDRESSES: process.env.ADMIN_WALLET_ADDRESSES ?? "",
} as const;
