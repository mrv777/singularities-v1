use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::delegate_account;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

pub mod errors;
pub mod state;

use errors::SingularitiesError;
use state::HackSession;

// Replace after `anchor build` generates the real program ID
declare_id!("11111111111111111111111111111111");

pub const HACK_SEED: &[u8] = b"hack";

/// Base chance constant — mirrors SCANNER_BALANCE.hackSuccess.baseChance
const BASE_CHANCE: i16 = 58;

#[delegate]
#[program]
pub mod singularities_vrf {
    use super::*;

    // ---------------------------------------------------------------
    // 1. INITIATE HACK — create HackSession PDA on base layer
    // ---------------------------------------------------------------
    pub fn initiate_hack(
        ctx: Context<InitiateHack>,
        hack_nonce: u64,
        hack_power: u16,
        stealth: u16,
        security_level: u16,
        detection_chance: u16,
        heat_level: u8,
        success_floor: u8,
    ) -> Result<()> {
        require!(security_level > 0, SingularitiesError::InvalidParams);
        require!(success_floor >= 20 && success_floor <= 95, SingularitiesError::InvalidParams);

        let session = &mut ctx.accounts.hack_session;
        session.player_wallet = ctx.accounts.player_wallet.key();
        session.hack_nonce = hack_nonce;
        session.hack_power = hack_power;
        session.stealth = stealth;
        session.security_level = security_level;
        session.detection_chance = detection_chance;
        session.heat_level = heat_level;
        session.success_floor = success_floor;
        session.status = 0; // pending
        session.success = false;
        session.detected = false;
        session.success_roll = 0;
        session.success_chance = 0;
        session.detection_roll = 0;
        session.effective_detection = 0;
        session.damage_seed = [0u8; 8];
        session.bump = ctx.bumps.hack_session;

        msg!(
            "Hack initiated: player={}, nonce={}, power={}, sec={}",
            session.player_wallet,
            hack_nonce,
            hack_power,
            security_level
        );
        Ok(())
    }

    // ---------------------------------------------------------------
    // 2. DELEGATE HACK — delegate PDA to Ephemeral Rollup
    // ---------------------------------------------------------------
    pub fn delegate_hack(ctx: Context<DelegateHack>, hack_nonce: u64) -> Result<()> {
        let player_wallet = ctx.accounts.player_wallet.key();
        let nonce_bytes = hack_nonce.to_le_bytes();
        let pda_seeds: &[&[u8]] = &[HACK_SEED, player_wallet.as_ref(), &nonce_bytes];

        delegate_account(
            &ctx.accounts.payer,
            &ctx.accounts.hack_session,
            &ctx.accounts.owner_program,
            &ctx.accounts.buffer,
            &ctx.accounts.delegation_record,
            &ctx.accounts.delegate_account_seeds,
            &ctx.accounts.delegation_program,
            &ctx.accounts.system_program,
            pda_seeds,
            0,     // unlimited delegation lifetime
            30000, // 30s commit interval
        )?;

        msg!("Hack session delegated to ER");
        Ok(())
    }

    // ---------------------------------------------------------------
    // 3. REQUEST HACK RANDOMNESS — request VRF on Ephemeral Rollup
    // ---------------------------------------------------------------
    pub fn request_hack_randomness(ctx: Context<RequestHackRandomness>, client_seed: u8) -> Result<()> {
        let session = &ctx.accounts.hack_session;
        require!(session.status == 0, SingularitiesError::AlreadyResolved);

        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: instruction::ResolveHack::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.hack_session.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });

        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;

        msg!("VRF randomness requested for hack session");
        Ok(())
    }

    // ---------------------------------------------------------------
    // 4. RESOLVE HACK — VRF oracle callback with randomness
    // ---------------------------------------------------------------
    pub fn resolve_hack(ctx: Context<ResolveHack>, randomness: [u8; 32]) -> Result<()> {
        let session = &mut ctx.accounts.hack_session;
        require!(session.status == 0, SingularitiesError::AlreadyResolved);

        // --- Derive rolls from VRF randomness ---
        // Use u16 from 2 bytes to reduce modulo bias (65536 mod 100 = 36, <1% bias)
        let r0 = u16::from_le_bytes([randomness[0], randomness[1]]);
        let success_roll = ((r0 % 100) + 1) as u8; // 1-100

        let r1 = u16::from_le_bytes([randomness[2], randomness[3]]);
        let detection_roll = ((r1 % 100) + 1) as u8; // 1-100

        // --- Success chance: max(floor, min(95, 58 + hackPower - securityLevel)) ---
        let raw_chance = BASE_CHANCE + (session.hack_power as i16) - (session.security_level as i16);
        let clamped = raw_chance
            .max(session.success_floor as i16)
            .min(95);
        let success_chance = clamped as u8;

        let success = success_roll <= success_chance;

        // --- Detection (only when hack fails) ---
        // effective_detection = max(5, min(95, detection_chance - stealth/2))
        let stealth_reduction = (session.stealth / 2) as i16;
        let raw_detection = (session.detection_chance as i16) - stealth_reduction;
        let effective_detection = raw_detection.max(5).min(95) as u8;
        let detected = !success && (detection_roll <= effective_detection);

        // --- Damage seed: 8 bytes for deterministic server-side derivation ---
        let mut damage_seed = [0u8; 8];
        damage_seed.copy_from_slice(&randomness[8..16]);

        // --- Store results ---
        session.status = 1; // resolved
        session.success = success;
        session.detected = detected;
        session.success_roll = success_roll;
        session.success_chance = success_chance;
        session.detection_roll = detection_roll;
        session.effective_detection = effective_detection;
        session.damage_seed = damage_seed;

        msg!(
            "Hack resolved: success={}, roll={}/{}, detected={}",
            success,
            success_roll,
            success_chance,
            detected
        );
        Ok(())
    }
}

// =================================================================
// Account structs
// =================================================================

#[derive(Accounts)]
#[instruction(
    hack_nonce: u64,
    hack_power: u16,
    stealth: u16,
    security_level: u16,
    detection_chance: u16,
    heat_level: u8,
    success_floor: u8
)]
pub struct InitiateHack<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The player's wallet address (not a signer — server submits on behalf)
    /// CHECK: Validated by PDA derivation
    pub player_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = HackSession::LEN,
        seeds = [HACK_SEED, player_wallet.key().as_ref(), &hack_nonce.to_le_bytes()],
        bump
    )]
    pub hack_session: Account<'info, HackSession>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(hack_nonce: u64)]
pub struct DelegateHack<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Validated by PDA derivation
    pub player_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [HACK_SEED, player_wallet.key().as_ref(), &hack_nonce.to_le_bytes()],
        bump = hack_session.bump
    )]
    pub hack_session: Account<'info, HackSession>,

    /// CHECK: Delegation program account
    pub owner_program: UncheckedAccount<'info>,
    /// CHECK: Delegation buffer
    #[account(mut)]
    pub buffer: UncheckedAccount<'info>,
    /// CHECK: Delegation record
    #[account(mut)]
    pub delegation_record: UncheckedAccount<'info>,
    /// CHECK: Delegate account seeds
    #[account(mut)]
    pub delegate_account_seeds: UncheckedAccount<'info>,
    /// CHECK: Delegation program
    pub delegation_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct RequestHackRandomness<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub hack_session: Account<'info, HackSession>,

    /// CHECK: MagicBlock oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ResolveHack<'info> {
    /// VRF oracle identity — verifies callback authenticity
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    #[account(mut)]
    pub hack_session: Account<'info, HackSession>,
}
