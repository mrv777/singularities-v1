# Chain Integration — Next Steps

## 1. Install Toolchain
- Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Install Solana CLI: `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`
- Install Anchor CLI: `cargo install --git https://github.com/coral-xyz/anchor avm --force && avm install 0.31.1 && avm use 0.31.1`

## 2. Build & Deploy Anchor Program
```bash
cd packages/chain
anchor build
# Copy the generated program ID from target/deploy/singularities_vrf-keypair.json
anchor keys list
# Update declare_id!() in programs/singularities-vrf/src/lib.rs with the real program ID
# Update Anchor.toml [programs.devnet] with the same ID
anchor build  # rebuild with correct ID
anchor deploy --provider.cluster devnet
```

## 3. Generate Server Keypair & Fund It
```bash
solana-keygen new -o packages/server/server-keypair.json --no-bip39-passphrase
solana airdrop 2 --keypair packages/server/server-keypair.json --url devnet
```

## 4. Run DB Migration
```bash
pnpm db:migrate
```

## 5. Configure Server .env
Add to `packages/server/.env`:
```
CHAIN_RESOLUTION_ENABLED=true
PROGRAM_ID=<deployed program id from step 2>
SERVER_KEYPAIR_PATH=./server-keypair.json
MAGICBLOCK_ROUTER_URL=https://devnet-router.magicblock.app
```

## 6. Test
- **Fallback**: Start server with `CHAIN_RESOLUTION_ENABLED=false` — hacks work identically to before
- **On-chain**: Start with `CHAIN_RESOLUTION_ENABLED=true` — hack results come from VRF, "Verified on-chain" badge appears with Solana Explorer link
- **Anchor tests**: `cd packages/chain && anchor test --skip-local-validator` (hits devnet + MagicBlock VRF oracle)

## 7. Hackathon Polish (if time)
- [ ] Verification history UI — show past chain-verified results with tx links
- [ ] Binary Decisions on-chain — `DecisionSession` PDA + VRF for trigger chance
- [ ] PvP Combat on-chain — `CombatSession` PDA + VRF for win roll
- [ ] Demo video / screenshots for submission
