import {
  createUmi,
} from "@metaplex-foundation/umi-bundle-defaults";
import {
  create,
  burnV1,
  fetchAssetV1,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import {
  publicKey as umiPublicKey,
  generateSigner,
  createSignerFromKeypair,
  signerIdentity,
  type Umi,
  type KeypairSigner,
} from "@metaplex-foundation/umi";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { env } from "../lib/env.js";
import { query } from "../db/pool.js";
import { getMintPriceLamports } from "./solPrice.js";

// ---------------------------------------------------------------------------
// State (lazy singletons)
// ---------------------------------------------------------------------------

let umi: Umi | null = null;
let serverKeypair: Keypair | null = null;
let umiServerSigner: KeypairSigner | null = null;
let connection: Connection | null = null;

function getServerKeypair(): Keypair {
  if (!serverKeypair) {
    const raw = JSON.parse(readFileSync(env.SERVER_KEYPAIR_PATH, "utf-8"));
    serverKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  return serverKeypair;
}

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  }
  return connection;
}

function getUmi(): Umi {
  if (!umi) {
    const kp = getServerKeypair();
    umi = createUmi(env.SOLANA_RPC_URL).use(mplCore());
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(kp.secretKey);
    umiServerSigner = createSignerFromKeypair(umi, umiKeypair);
    umi.use(signerIdentity(umiServerSigner));
  }
  return umi;
}

function getUmiSigner(): KeypairSigner {
  getUmi(); // ensure initialized
  return umiServerSigner!;
}

// ---------------------------------------------------------------------------
// Build mint transaction (partially signed by server)
// ---------------------------------------------------------------------------

export async function buildMintTransaction(
  playerWallet: string,
  aiName: string,
  _imageUri: string
): Promise<{ serializedTx: string; mintAddress: string }> {
  const conn = getConnection();
  const server = getServerKeypair();
  const payer = new PublicKey(playerWallet);
  const treasury = new PublicKey(env.TREASURY_WALLET_ADDRESS);

  // Get mint price
  const { lamports } = await getMintPriceLamports();

  // Build payment instruction
  const paymentIx = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: treasury,
    lamports,
  });

  // Build mpl-core create via Umi
  const umiInstance = getUmi();
  const umiAssetSigner = generateSigner(umiInstance);
  const mintAddress = umiAssetSigner.publicKey.toString();

  const metadataUri = `${env.NFT_METADATA_BASE_URL}/api/nft/metadata/${mintAddress}`;

  const createBuilder = create(umiInstance, {
    asset: umiAssetSigner,
    name: aiName,
    uri: metadataUri,
    plugins: [
      {
        type: "BurnDelegate",
        authority: {
          type: "Address",
          address: umiPublicKey(server.publicKey.toBase58()),
        },
      },
    ],
  });

  // Build Umi transaction to extract instructions
  const umiTx = await createBuilder.buildWithLatestBlockhash(umiInstance);
  const umiSerialized = umiInstance.transactions.serialize(umiTx);
  const umiVersionedTx = VersionedTransaction.deserialize(umiSerialized);

  // Extract instructions from Umi's compiled message
  const umiMessage = umiVersionedTx.message;
  const staticKeys = umiMessage.staticAccountKeys;
  const compiledIxs = umiMessage.compiledInstructions;

  const allInstructions: TransactionInstruction[] = [paymentIx];

  for (const cIx of compiledIxs) {
    const programId = staticKeys[cIx.programIdIndex];
    const keys = cIx.accountKeyIndexes.map((idx) => {
      const pubkey = staticKeys[idx];
      return {
        pubkey,
        isSigner: umiMessage.isAccountSigner(idx),
        isWritable: umiMessage.isAccountWritable(idx),
      };
    });
    allInstructions.push(
      new TransactionInstruction({
        programId,
        keys,
        data: Buffer.from(cIx.data),
      })
    );
  }

  // Build final combined transaction with player as payer
  const { blockhash } = await conn.getLatestBlockhash("confirmed");

  const combinedMessage = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: allInstructions,
  }).compileToV0Message();

  const combinedTx = new VersionedTransaction(combinedMessage);

  // Partially sign with server keypair (burn delegate authority) and asset keypair
  const assetKp = Keypair.fromSecretKey(umiAssetSigner.secretKey);
  combinedTx.sign([server, assetKp]);

  const serializedTx = Buffer.from(combinedTx.serialize()).toString("base64");

  return { serializedTx, mintAddress };
}

// ---------------------------------------------------------------------------
// Submit a player-signed mint transaction
// ---------------------------------------------------------------------------

export async function submitMintTransaction(
  signedTxBase64: string,
  _expectedMint: string,
  _expectedPayer: string
): Promise<string> {
  const conn = getConnection();
  const txBytes = Buffer.from(signedTxBase64, "base64");
  const tx = VersionedTransaction.deserialize(txBytes);

  const sig = await conn.sendTransaction(tx, { skipPreflight: false });
  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return sig;
}

// ---------------------------------------------------------------------------
// Burn an NFT using server's BurnDelegate authority
// ---------------------------------------------------------------------------

export async function burnNft(mintAddress: string): Promise<string> {
  const umiInstance = getUmi();
  const signer = getUmiSigner();

  const builder = burnV1(umiInstance, {
    asset: umiPublicKey(mintAddress),
    collection: env.COLLECTION_ADDRESS
      ? umiPublicKey(env.COLLECTION_ADDRESS)
      : undefined,
    authority: signer,
  });

  const result = await builder.sendAndConfirm(umiInstance);
  return Buffer.from(result.signature).toString("base64");
}

// ---------------------------------------------------------------------------
// Retry pending burns
// ---------------------------------------------------------------------------

const MAX_BURN_RETRIES = 5;

export async function retryPendingBurns(): Promise<void> {
  const pending = await query(
    `SELECT * FROM pending_nft_burns
     WHERE retry_count < $1
       AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '2 minutes')
     ORDER BY created_at ASC
     LIMIT 10`,
    [MAX_BURN_RETRIES]
  );

  for (const row of pending.rows) {
    const mintAddress = row.mint_address as string;
    const id = row.id as string;
    try {
      await burnNft(mintAddress);
      await query("DELETE FROM pending_nft_burns WHERE id = $1", [id]);
      console.log(`[nft] Successfully burned pending NFT ${mintAddress}`);
    } catch (err) {
      await query(
        "UPDATE pending_nft_burns SET retry_count = retry_count + 1, last_attempt_at = NOW() WHERE id = $1",
        [id]
      );
      console.error(`[nft] Failed to burn ${mintAddress}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Check asset owner (for transfer detection)
// ---------------------------------------------------------------------------

export async function checkAssetOwner(
  mintAddress: string
): Promise<string | null> {
  try {
    const umiInstance = getUmi();
    const asset = await fetchAssetV1(umiInstance, umiPublicKey(mintAddress));
    return asset.owner.toString();
  } catch {
    return null;
  }
}
