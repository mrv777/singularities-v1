use anchor_lang::prelude::*;

#[error_code]
pub enum SingularitiesError {
    #[msg("Hack session already resolved")]
    AlreadyResolved,
    #[msg("Hack session not yet resolved")]
    NotResolved,
    #[msg("Invalid hack parameters")]
    InvalidParams,
    #[msg("Unauthorized callback — only VRF oracle may resolve")]
    UnauthorizedCallback,
}
