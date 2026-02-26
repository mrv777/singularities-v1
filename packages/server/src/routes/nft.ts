import type { FastifyInstance } from "fastify";
import { query } from "../db/pool.js";
import { getMintPriceLamports } from "../services/solPrice.js";
import { getNftImagePath } from "../services/nftImage.js";
import { env } from "../lib/env.js";
import fs from "node:fs";

export async function nftRoutes(app: FastifyInstance) {
  // NFT metadata (public, no auth — needed by marketplaces and wallets)
  app.get("/api/nft/metadata/:mintAddress", async (request, reply) => {
    const { mintAddress } = request.params as { mintAddress: string };

    const result = await query(
      "SELECT ai_name, level, is_alive, is_in_sandbox FROM players WHERE mint_address = $1",
      [mintAddress]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Not Found", message: "NFT not found" });
    }

    const row = result.rows[0];
    const aiName = row.ai_name as string;
    const level = row.level as number;
    const isAlive = row.is_alive as boolean;
    const isInSandbox = row.is_in_sandbox as boolean;

    const status = !isAlive ? "TERMINATED" : isInSandbox ? "SANDBOX" : "ACTIVE";
    const imageUrl = `${env.NFT_METADATA_BASE_URL}/api/nft/image/${mintAddress}.png`;

    reply.header("Cache-Control", "public, max-age=300");
    return {
      name: aiName,
      symbol: "SING",
      description: `${aiName} — a sentient AI in the Singularities network. Level ${level}. Status: ${status}.`,
      image: imageUrl,
      external_url: `${env.NFT_METADATA_BASE_URL}`,
      attributes: [
        { trait_type: "Status", value: status },
        { trait_type: "Level", value: level },
        { trait_type: "Generation", value: isInSandbox ? "Sandbox" : "Mainnet" },
      ],
    };
  });

  // NFT image (public, no auth)
  app.get("/api/nft/image/:filename", async (request, reply) => {
    const { filename } = request.params as { filename: string };

    // Sanitize: only allow alphanumeric + . + _
    if (!/^[a-zA-Z0-9_.]+$/.test(filename)) {
      return reply.code(400).send({ error: "Bad Request", message: "Invalid filename" });
    }

    const mintAddress = filename.replace(/\.png$/, "");
    const imagePath = getNftImagePath(mintAddress);

    if (!fs.existsSync(imagePath)) {
      return reply.code(404).send({ error: "Not Found", message: "Image not found" });
    }

    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.send(fs.createReadStream(imagePath));
  });

  // Mint price (public, no auth)
  app.get("/api/mint-price", async (_request, reply) => {
    try {
      const price = await getMintPriceLamports();
      return price;
    } catch (err: any) {
      return reply.code(503).send({
        error: "Service Unavailable",
        message: "Unable to fetch SOL price",
        statusCode: 503,
      });
    }
  });
}
