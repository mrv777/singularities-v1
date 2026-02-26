import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { env } from "../lib/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = path.resolve(__dirname, "../../public/nft");

// Ensure output directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

/**
 * Derive deterministic colors and patterns from a mint address hash.
 */
function seedFromMint(mintAddress: string): {
  bytes: Buffer;
  color1: string;
  color2: string;
  color3: string;
  accent: string;
} {
  const hash = createHash("sha256").update(mintAddress).digest();
  const color1 = `rgb(${hash[0]}, ${hash[1]}, ${hash[2]})`;
  const color2 = `rgb(${hash[3]}, ${hash[4]}, ${hash[5]})`;
  const color3 = `rgb(${hash[6]}, ${hash[7]}, ${hash[8]})`;
  // Accent: always high-saturation cyan/magenta range
  const hue = (hash[9] / 255) * 360;
  const accent = `hsl(${hue.toFixed(0)}, 90%, 60%)`;
  return { bytes: hash, color1, color2, color3, accent };
}

/**
 * Generate a cyberpunk-styled SVG avatar for an AI entity.
 */
function generateSvg(aiName: string, mintAddress: string): string {
  const seed = seedFromMint(mintAddress);
  const b = seed.bytes;

  // Generate grid pattern cells
  const gridCells: string[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const byteIndex = (row * 4 + col) % 32;
      const val = b[byteIndex];
      if (val > 100) {
        const opacity = (val / 255).toFixed(2);
        const x = 60 + col * 30;
        const mirrorX = 60 + (7 - col) * 30;
        const y = 100 + row * 30;
        gridCells.push(
          `<rect x="${x}" y="${y}" width="28" height="28" rx="2" fill="${seed.accent}" opacity="${opacity}"/>`,
          `<rect x="${mirrorX}" y="${y}" width="28" height="28" rx="2" fill="${seed.accent}" opacity="${opacity}"/>`
        );
      }
    }
  }

  // Circuit-line decorations
  const lines: string[] = [];
  for (let i = 0; i < 6; i++) {
    const x1 = 20 + (b[(i * 3) % 32] / 255) * 360;
    const y1 = 360 + i * 12;
    const x2 = x1 + 40 + (b[(i * 3 + 1) % 32] / 255) * 80;
    lines.push(
      `<line x1="${x1.toFixed(0)}" y1="${y1}" x2="${x2.toFixed(0)}" y2="${y1}" stroke="${seed.accent}" stroke-width="1" opacity="0.4"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1a"/>
      <stop offset="50%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:#0a0a1a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${seed.accent};stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:${seed.accent};stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="400" height="500" fill="url(#bg)"/>

  <!-- Subtle grid overlay -->
  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${seed.accent}" stroke-width="0.3" opacity="0.15"/>
  </pattern>
  <rect width="400" height="500" fill="url(#grid)"/>

  <!-- Top glow -->
  <rect width="400" height="200" fill="url(#glow)"/>

  <!-- Border -->
  <rect x="4" y="4" width="392" height="492" rx="8" fill="none" stroke="${seed.accent}" stroke-width="1" opacity="0.5"/>

  <!-- Header bar -->
  <rect x="20" y="20" width="360" height="3" fill="${seed.accent}" opacity="0.6"/>
  <text x="200" y="55" text-anchor="middle" font-family="monospace" font-size="11" fill="${seed.accent}" opacity="0.6">SINGULARITIES // NFT</text>

  <!-- Identity grid (symmetrical pixel art) -->
  ${gridCells.join("\n  ")}

  <!-- Circuit decorations -->
  ${lines.join("\n  ")}

  <!-- AI Name -->
  <text x="200" y="440" text-anchor="middle" font-family="monospace" font-size="22" font-weight="bold" fill="${seed.accent}">${escapeXml(aiName.toUpperCase())}</text>

  <!-- Mint address footer -->
  <text x="200" y="470" text-anchor="middle" font-family="monospace" font-size="8" fill="#555">${mintAddress.slice(0, 20)}...${mintAddress.slice(-8)}</text>

  <!-- Bottom bar -->
  <rect x="20" y="482" width="360" height="3" fill="${seed.accent}" opacity="0.6"/>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate and save an NFT image. Returns the public URL.
 */
export async function generateNftImage(
  aiName: string,
  mintAddress: string
): Promise<string> {
  const svg = generateSvg(aiName, mintAddress);
  const outputPath = path.join(IMAGE_DIR, `${mintAddress}.png`);

  await sharp(Buffer.from(svg)).resize(400, 500).png().toFile(outputPath);

  return `${env.NFT_METADATA_BASE_URL}/api/nft/image/${mintAddress}.png`;
}

/**
 * Get the filesystem path for a generated image.
 */
export function getNftImagePath(mintAddress: string): string {
  return path.join(IMAGE_DIR, `${mintAddress}.png`);
}
