import { PVP_BALANCE } from "./balance.js";

// Diversity bonus: reward for equipping modules from different tech tree categories
export const DIVERSITY_BONUS: Record<number, number> = { 1: 0, 2: 15, 3: 30 };

// PvP Combat Constants

export const PVP_ENERGY_COST = 17;

// Daily damage cap: 240 HP total (40% of 600 total HP across 6 systems at 100 each)
export const PVP_DAILY_DAMAGE_CAP = 240;

// Max attacks a player can receive per day
export const PVP_MAX_ATTACKS_RECEIVED = 3;

// Matchmaking: opponent must be within ±5 levels
export const PVP_LEVEL_RANGE = 5;

// New player arena protection: defenders at or below this level get a tighter attack range
export const PVP_NEW_PLAYER_LEVEL_CAP = 10;
// Max levels above defender allowed when defender is a new arena player
export const PVP_NEW_PLAYER_MAX_ATTACKER_ADVANTAGE = 2;

// Win chance calculation: 50% + (attackPower - defensePower) / scaleFactor
export const PVP_WIN_CHANCE_MIN = 15;
export const PVP_WIN_CHANCE_MAX = 85;
export const PVP_WIN_CHANCE_SCALE = 125;

// Winner rewards (scaled by defender level)
export const PVP_REWARD_CREDITS_MIN = PVP_BALANCE.rewardCredits.baseMin;
export const PVP_REWARD_CREDITS_MAX = PVP_BALANCE.rewardCredits.baseMax;
export const PVP_REWARD_REPUTATION_MIN = 20;
export const PVP_REWARD_REPUTATION_MAX = 30;
export const PVP_REWARD_XP = 30;
export const PVP_REWARD_CREDITS_STEAL_PCT_MIN = PVP_BALANCE.rewardCredits.stealPctMin;
export const PVP_REWARD_CREDITS_STEAL_PCT_MAX = PVP_BALANCE.rewardCredits.stealPctMax;
export const PVP_REWARD_CREDITS_LEVEL_BONUS = PVP_BALANCE.rewardCredits.levelBonusPerLevel;
export const PVP_REWARD_DATA_MIN = PVP_BALANCE.rewardData.baseMin;
export const PVP_REWARD_DATA_MAX = PVP_BALANCE.rewardData.baseMax;
export const PVP_REWARD_DATA_LEVEL_BONUS = PVP_BALANCE.rewardData.levelBonusPerLevel;
export const PVP_REWARD_PROCESSING_POWER_MIN = PVP_BALANCE.rewardProcessingPower.min;
export const PVP_REWARD_PROCESSING_POWER_MAX = PVP_BALANCE.rewardProcessingPower.max;

// Loser damage: 10-20% per system, 1-2 systems affected
export const PVP_LOSER_DAMAGE_MIN_PCT = 10;
export const PVP_LOSER_DAMAGE_MAX_PCT = 20;
export const PVP_LOSER_SYSTEMS_MIN = 1;
export const PVP_LOSER_SYSTEMS_MAX = 2;

// Default defense power when no loadout configured
export const PVP_DEFAULT_DEFENSE_POWER = 8;

// Combat narrative templates
export const COMBAT_ATTACK_PHRASES = [
  "launches a neural spike at",
  "deploys exploit chain against",
  "initiates packet flood on",
  "fires quantum crack at",
  "unleashes data barrage on",
];

export const COMBAT_DEFEND_PHRASES = [
  "raises firewall barriers",
  "deploys countermeasure protocols",
  "activates shield matrix",
  "engages redundancy buffers",
  "reroutes through backup systems",
];

export const COMBAT_HIT_PHRASES = [
  "breaches outer defenses",
  "penetrates security layer",
  "overloads target subsystem",
  "corrupts data pathway",
  "disrupts neural link",
];

export const COMBAT_MISS_PHRASES = [
  "deflected by defensive matrix",
  "absorbed by firewall",
  "neutralized by countermeasures",
  "evaded via ghost protocol",
  "blocked by redundancy layer",
];
