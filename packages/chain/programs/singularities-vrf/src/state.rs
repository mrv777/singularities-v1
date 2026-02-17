use anchor_lang::prelude::*;

/// PDA storing hack parameters and VRF-resolved outcome.
/// Seeds: ["hack", player_wallet, hack_nonce.to_le_bytes()]
#[account]
pub struct HackSession {
    /// Player's wallet public key
    pub player_wallet: Pubkey,
    /// Unique nonce per hack (from Redis counter on server)
    pub hack_nonce: u64,
    /// Effective hack power (modules x health multiplier)
    pub hack_power: u16,
    /// Effective stealth stat
    pub stealth: u16,
    /// Target security level
    pub security_level: u16,
    /// Target detection chance (%)
    pub detection_chance: u16,
    /// Current heat level
    pub heat_level: u8,
    /// Minimum success chance (level-based floor)
    pub success_floor: u8,

    // --- Resolved by VRF callback ---

    /// 0 = pending, 1 = resolved
    pub status: u8,
    /// Whether the hack succeeded
    pub success: bool,
    /// Whether the player was detected (only meaningful if !success)
    pub detected: bool,
    /// The actual success roll (1-100)
    pub success_roll: u8,
    /// Calculated success chance (%)
    pub success_chance: u8,
    /// Detection roll (1-100), only if hack failed
    pub detection_roll: u8,
    /// Calculated effective detection chance (%)
    pub effective_detection: u8,
    /// Raw random bytes for deterministic damage derivation on server
    pub damage_seed: [u8; 8],
    /// PDA bump
    pub bump: u8,
}

impl HackSession {
    /// Account discriminator (8) + all fields
    pub const LEN: usize = 8  // discriminator
        + 32  // player_wallet (Pubkey)
        + 8   // hack_nonce (u64)
        + 2   // hack_power (u16)
        + 2   // stealth (u16)
        + 2   // security_level (u16)
        + 2   // detection_chance (u16)
        + 1   // heat_level (u8)
        + 1   // success_floor (u8)
        + 1   // status (u8)
        + 1   // success (bool)
        + 1   // detected (bool)
        + 1   // success_roll (u8)
        + 1   // success_chance (u8)
        + 1   // detection_roll (u8)
        + 1   // effective_detection (u8)
        + 8   // damage_seed ([u8; 8])
        + 1;  // bump (u8)
}
