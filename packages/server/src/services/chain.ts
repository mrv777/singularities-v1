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
import { redis } from "../db/redis.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainHackParams {
  playerWallet: string;
  hackPower: number;
  stealth: number;
  securityLevel: number;
  detectionChance: number;
  heatLevel: number;
  successFloor: number;
}

export interface ChainHackResult {
  successRoll: number;
  successChance: number;
  success: boolean;
  detectionRoll: number;
  effectiveDetection: number;
  detected: boolean;
  damageSeed: number[];
  txSignature: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HACK_SEED = Buffer.from("hack");
const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 10_000;

// Anchor discriminators (first 8 bytes of SHA256("global:<instruction_name>"))
// These are pre-computed for the singularities_vrf program instructions.
// Re-generate if instruction names change.
import { createHash } from "node:crypto";

function anchorDiscriminator(name: string): Buffer {
  return Buffer.from(
    createHash("sha256").update(`global:${name}`).digest().subarray(0, 8)
  );
}

const IX_INITIATE = anchorDiscriminator("initiate_hack");
const IX_DELEGATE = anchorDiscriminator("delegate_hack");
const IX_REQUEST_RANDOMNESS = anchorDiscriminator("request_hack_randomness");

// Ephemeral Rollups delegation program
const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSS"
);

// MagicBlock VRF oracle queue (devnet default)
const DEFAULT_ORACLE_QUEUE = new PublicKey(
  "Fv3QBMF2RTKA3mMPFJRGFEZMiVj6ojeEHcAJBqRBPRi"
);

// VRF program ID
const VRF_PROGRAM_ID = new PublicKey(
  "VRFzZoJdhFWL8rkvu87LjBpCW57vMSweghstjqy3bJi"
);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let serverKeypair: Keypair | null = null;
let programId: PublicKey | null = null;
let baseConnection: Connection | null = null;
let erConnection: Connection | null = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function ensureInitialized() {
  if (!serverKeypair) {
    const raw = JSON.parse(readFileSync(env.SERVER_KEYPAIR_PATH, "utf-8"));
    serverKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  if (!programId) {
    if (!env.PROGRAM_ID) throw new Error("PROGRAM_ID env var not set");
    programId = new PublicKey(env.PROGRAM_ID);
  }
  if (!baseConnection) {
    baseConnection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  }
  if (!erConnection) {
    erConnection = new Connection(env.MAGICBLOCK_ROUTER_URL, "confirmed");
  }
}

// ---------------------------------------------------------------------------
// Nonce management
// ---------------------------------------------------------------------------

async function nextHackNonce(): Promise<bigint> {
  const val = await redis.incr("chain:hack_nonce");
  return BigInt(val);
}

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

function findHackSessionPDA(
  playerWallet: PublicKey,
  hackNonce: bigint,
  progId: PublicKey
): [PublicKey, number] {
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(hackNonce);
  return PublicKey.findProgramAddressSync(
    [HACK_SEED, playerWallet.toBuffer(), nonceBytes],
    progId
  );
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

function buildInitiateHackIx(
  payer: PublicKey,
  playerWallet: PublicKey,
  hackSessionPDA: PublicKey,
  params: ChainHackParams,
  hackNonce: bigint
): TransactionInstruction {
  // Borsh-serialize: discriminator + u64 + u16 + u16 + u16 + u16 + u8 + u8
  const data = Buffer.alloc(8 + 8 + 2 + 2 + 2 + 2 + 1 + 1);
  let offset = 0;
  IX_INITIATE.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(hackNonce, offset); offset += 8;
  data.writeUInt16LE(params.hackPower, offset); offset += 2;
  data.writeUInt16LE(params.stealth, offset); offset += 2;
  data.writeUInt16LE(params.securityLevel, offset); offset += 2;
  data.writeUInt16LE(params.detectionChance, offset); offset += 2;
  data.writeUInt8(params.heatLevel, offset); offset += 1;
  data.writeUInt8(params.successFloor, offset); offset += 1;

  return new TransactionInstruction({
    programId: programId!,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: playerWallet, isSigner: false, isWritable: false },
      { pubkey: hackSessionPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildDelegateHackIx(
  payer: PublicKey,
  playerWallet: PublicKey,
  hackSessionPDA: PublicKey,
  hackNonce: bigint
): TransactionInstruction {
  const data = Buffer.alloc(8 + 8);
  let offset = 0;
  IX_DELEGATE.copy(data, offset); offset += 8;
  data.writeBigUInt64LE(hackNonce, offset); offset += 8;

  // Derive delegation-related PDAs
  const [buffer] = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), hackSessionPDA.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
  const [delegationRecord] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), hackSessionPDA.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
  const [delegateAccountSeeds] = PublicKey.findProgramAddressSync(
    [Buffer.from("delegate-account-seeds"), hackSessionPDA.toBuffer()],
    DELEGATION_PROGRAM_ID
  );

  return new TransactionInstruction({
    programId: programId!,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: playerWallet, isSigner: false, isWritable: false },
      { pubkey: hackSessionPDA, isSigner: false, isWritable: true },
      { pubkey: programId!, isSigner: false, isWritable: false }, // owner_program
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: delegationRecord, isSigner: false, isWritable: true },
      { pubkey: delegateAccountSeeds, isSigner: false, isWritable: true },
      { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function buildRequestRandomnessIx(
  payer: PublicKey,
  hackSessionPDA: PublicKey,
  clientSeed: number
): TransactionInstruction {
  // discriminator + u8 client_seed
  const data = Buffer.alloc(8 + 1);
  IX_REQUEST_RANDOMNESS.copy(data, 0);
  data.writeUInt8(clientSeed, 8);

  // The #[vrf] macro adds additional accounts for the VRF CPI.
  // We provide the base accounts; the VRF SDK's runtime adds the rest.
  // For now we provide the accounts the instruction expects.
  return new TransactionInstruction({
    programId: programId!,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: hackSessionPDA, isSigner: false, isWritable: true },
      { pubkey: DEFAULT_ORACLE_QUEUE, isSigner: false, isWritable: true },
      // Additional VRF accounts are injected by the #[vrf] macro at runtime
      { pubkey: VRF_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------------------
// Send + confirm helper
// ---------------------------------------------------------------------------

async function sendAndConfirm(
  connection: Connection,
  ixs: TransactionInstruction[],
  signers: Keypair[]
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: signers[0].publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign(signers);

  const sig = await connection.sendTransaction(tx, { skipPreflight: true });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}

// ---------------------------------------------------------------------------
// Poll for resolved HackSession
// ---------------------------------------------------------------------------

interface HackSessionData {
  status: number;
  success: boolean;
  detected: boolean;
  successRoll: number;
  successChance: number;
  detectionRoll: number;
  effectiveDetection: number;
  damageSeed: number[];
}

async function pollHackSession(
  connection: Connection,
  pda: PublicKey
): Promise<HackSessionData> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const info = await connection.getAccountInfo(pda, "confirmed");
    if (info && info.data.length >= 8 + 66) {
      // Skip 8-byte Anchor discriminator
      const data = info.data;
      let offset = 8;

      // Skip: player_wallet(32) + hack_nonce(8) + hack_power(2) + stealth(2) +
      //        security_level(2) + detection_chance(2) + heat_level(1) + success_floor(1)
      offset += 32 + 8 + 2 + 2 + 2 + 2 + 1 + 1; // = 50

      const status = data.readUInt8(offset); offset += 1;
      if (status === 1) {
        const success = data.readUInt8(offset) !== 0; offset += 1;
        const detected = data.readUInt8(offset) !== 0; offset += 1;
        const successRoll = data.readUInt8(offset); offset += 1;
        const successChance = data.readUInt8(offset); offset += 1;
        const detectionRoll = data.readUInt8(offset); offset += 1;
        const effectiveDetection = data.readUInt8(offset); offset += 1;
        const damageSeed = Array.from(data.subarray(offset, offset + 8));

        return {
          status,
          success,
          detected,
          successRoll,
          successChance,
          detectionRoll,
          effectiveDetection,
          damageSeed,
        };
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Hack session poll timed out");
}

// ---------------------------------------------------------------------------
// Deterministic damage derivation from on-chain seed
// ---------------------------------------------------------------------------

/**
 * Derive a deterministic integer in [min, max] from a seed byte array at a
 * given offset. Anyone with the seed can reproduce the same value.
 */
export function deriveFromSeed(
  seed: number[],
  min: number,
  max: number,
  offset: number
): number {
  const range = max - min + 1;
  // Use two bytes for less modulo bias
  const idx = offset % (seed.length - 1);
  const raw = (seed[idx] << 8) | seed[(idx + 1) % seed.length];
  return min + (raw % range);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function submitHackOnChain(
  params: ChainHackParams
): Promise<ChainHackResult> {
  ensureInitialized();
  const payer = serverKeypair!;
  const playerWallet = new PublicKey(params.playerWallet);
  const hackNonce = await nextHackNonce();

  const [hackSessionPDA] = findHackSessionPDA(
    playerWallet,
    hackNonce,
    programId!
  );

  // --- Step 1: Initiate hack on base layer ---
  await sendAndConfirm(
    baseConnection!,
    [
      buildInitiateHackIx(
        payer.publicKey,
        playerWallet,
        hackSessionPDA,
        params,
        hackNonce
      ),
    ],
    [payer]
  );

  // --- Step 2: Delegate to Ephemeral Rollup ---
  await sendAndConfirm(
    baseConnection!,
    [
      buildDelegateHackIx(
        payer.publicKey,
        playerWallet,
        hackSessionPDA,
        hackNonce
      ),
    ],
    [payer]
  );

  // --- Step 3: Request VRF randomness on ER ---
  const clientSeed = Math.floor(Math.random() * 256);
  const vrfSig = await sendAndConfirm(
    erConnection!,
    [buildRequestRandomnessIx(payer.publicKey, hackSessionPDA, clientSeed)],
    [payer]
  );

  // --- Step 4: Poll for resolved result ---
  const result = await pollHackSession(erConnection!, hackSessionPDA);

  return {
    successRoll: result.successRoll,
    successChance: result.successChance,
    success: result.success,
    detectionRoll: result.detectionRoll,
    effectiveDetection: result.effectiveDetection,
    detected: result.detected,
    damageSeed: result.damageSeed,
    txSignature: vrfSig,
  };
}
