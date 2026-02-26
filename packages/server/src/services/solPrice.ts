import { redis } from "../db/redis.js";
import { env } from "../lib/env.js";

const CACHE_KEY = "sol:price_usd";
const CACHE_TTL_SECONDS = 30;
const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Get cached SOL/USD price. Fetches from Jupiter first, falls back to CoinGecko.
 */
export async function getSolPriceUsd(): Promise<number> {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return parseFloat(cached);

  let price: number | null = null;

  // Primary: Jupiter Price API v2
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${SOL_MINT}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        data: Record<string, { price: string }>;
      };
      const raw = data.data?.[SOL_MINT]?.price;
      if (raw) price = parseFloat(raw);
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: CoinGecko
  if (!price) {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          solana: { usd: number };
        };
        if (data.solana?.usd) price = data.solana.usd;
      }
    } catch {
      // fall through
    }
  }

  if (!price) throw new Error("Failed to fetch SOL price from all sources");

  await redis.set(CACHE_KEY, price.toString(), "EX", CACHE_TTL_SECONDS);
  return price;
}

/**
 * Convert configured USD mint price to lamports using current SOL price.
 */
export async function getMintPriceLamports(): Promise<{
  lamports: number;
  sol: number;
  usd: number;
}> {
  const solPriceUsd = await getSolPriceUsd();
  const usd = env.MINT_PRICE_USD;
  const sol = usd / solPriceUsd;
  const lamports = Math.ceil(sol * LAMPORTS_PER_SOL);
  return { lamports, sol: parseFloat(sol.toFixed(6)), usd };
}
