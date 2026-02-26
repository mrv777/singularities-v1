/**
 * One-time setup script for Solana NFT minting infrastructure.
 *
 * Generates:
 * 1. Server keypair (signs mint transactions, acts as burn delegate)
 * 2. Treasury keypair (receives SOL payment from mints)
 * 3. Creates mpl-core collection on Solana (mainnet or devnet)
 *
 * Usage:
 *   npx tsx scripts/setup-solana.ts
 *
 * After running, copy the printed env vars into your .env file.
 * Fund the server keypair with enough SOL to cover transaction fees.
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore, createCollectionV1 } from "@metaplex-foundation/mpl-core";
import {
  generateSigner,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

async function main() {
  console.log("=== Singularities Solana Setup ===\n");
  console.log(`RPC: ${RPC_URL}\n`);

  // 1. Generate server keypair
  const serverKpPath = path.resolve("server-keypair.json");
  let serverKeypair: Keypair;
  if (fs.existsSync(serverKpPath)) {
    console.log(`Server keypair already exists at ${serverKpPath}, reusing.`);
    const raw = JSON.parse(fs.readFileSync(serverKpPath, "utf-8"));
    serverKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else {
    serverKeypair = Keypair.generate();
    fs.writeFileSync(serverKpPath, JSON.stringify(Array.from(serverKeypair.secretKey)));
    console.log(`Generated server keypair → ${serverKpPath}`);
  }
  console.log(`  Address: ${serverKeypair.publicKey.toBase58()}\n`);

  // 2. Generate treasury keypair
  const treasuryKpPath = path.resolve("treasury-keypair.json");
  let treasuryKeypair: Keypair;
  if (fs.existsSync(treasuryKpPath)) {
    console.log(`Treasury keypair already exists at ${treasuryKpPath}, reusing.`);
    const raw = JSON.parse(fs.readFileSync(treasuryKpPath, "utf-8"));
    treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else {
    treasuryKeypair = Keypair.generate();
    fs.writeFileSync(treasuryKpPath, JSON.stringify(Array.from(treasuryKeypair.secretKey)));
    console.log(`Generated treasury keypair → ${treasuryKpPath}`);
  }
  console.log(`  Address: ${treasuryKeypair.publicKey.toBase58()}\n`);

  // 3. Create mpl-core collection
  console.log("Creating mpl-core collection...\n");

  const umi = createUmi(RPC_URL).use(mplCore());
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(serverKeypair.secretKey);
  const umiSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(umiSigner));

  // Check balance
  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(serverKeypair.publicKey);
  console.log(`  Server balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.error("\n  ERROR: Server keypair needs SOL to create collection.");
    console.error(`  Fund address: ${serverKeypair.publicKey.toBase58()}`);
    console.error("  Then re-run this script.\n");
    printEnvVars(serverKeypair, treasuryKeypair, "");
    process.exit(1);
  }

  const collectionSigner = generateSigner(umi);

  const result = await createCollectionV1(umi, {
    collection: collectionSigner,
    name: "Singularities",
    uri: "", // Updated later with metadata if needed
  }).sendAndConfirm(umi);

  const collectionAddress = collectionSigner.publicKey.toString();
  console.log(`  Collection created: ${collectionAddress}`);
  console.log(`  Tx: ${Buffer.from(result.signature).toString("base64")}\n`);

  printEnvVars(serverKeypair, treasuryKeypair, collectionAddress);
}

function printEnvVars(server: Keypair, treasury: Keypair, collection: string) {
  console.log("=== Add these to your .env file ===\n");
  console.log(`SERVER_KEYPAIR_PATH=./server-keypair.json`);
  console.log(`TREASURY_WALLET_ADDRESS=${treasury.publicKey.toBase58()}`);
  console.log(`COLLECTION_ADDRESS=${collection}`);
  console.log(`SOLANA_RPC_URL=${RPC_URL}`);
  console.log(`SOLANA_NETWORK=mainnet-beta`);
  console.log(`MINT_PRICE_USD=5`);
  console.log(`NFT_METADATA_BASE_URL=https://your-domain.com`);
  console.log("");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
