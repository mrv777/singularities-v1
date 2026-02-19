export interface RippleThreshold {
  metric: string;
  /** How many times this activity must occur per active player to trigger */
  perPlayerRate: number;
  /**
   * Absolute minimum threshold regardless of player count.
   * Prevents a single hyper-active player from triggering events alone —
   * the effective threshold is max(absoluteMin, perPlayerRate * effectiveCount).
   * Per-player scaling only takes over once the playerbase is large enough.
   */
  absoluteMin: number;
  description: string;
}

/**
 * Minimum active player count used when computing scaled thresholds.
 * Acts as a secondary guard so a tiny cohort of players can't trivially trigger events.
 */
export const RIPPLE_MIN_ACTIVE_PLAYERS = 10;

export const RIPPLE_THRESHOLDS: RippleThreshold[] = [
  { metric: "totalHacks",    perPlayerRate: 8,   absoluteMin: 150, description: "High hacking activity detected" },
  { metric: "stealthUsage",  perPlayerRate: 4,   absoluteMin: 60,  description: "Widespread stealth operations" },
  { metric: "pvpBattles",    perPlayerRate: 3,   absoluteMin: 45,  description: "Intense PvP combat activity" },
  { metric: "deaths",        perPlayerRate: 0.5, absoluteMin: 7,   description: "Mass AI casualties" },
  { metric: "moduleUpgrades",perPlayerRate: 3,   absoluteMin: 45,  description: "Technology arms race detected" },
];

export interface RippleEvent {
  id: string;
  name: string;
  triggerMetric: string;
  narrative: string;
  effects: Record<string, number>;
  duration: "day";
}

export const RIPPLE_EVENTS: RippleEvent[] = [
  {
    id: "ripple_hack_surge",
    name: "Network Overload",
    triggerMetric: "totalHacks",
    narrative: "Massive hacking activity has overloaded the network. Systems are unstable but data flows freely.",
    effects: { hackRewardMultiplier: 1.30, degradationRateMultiplier: 1.40 },
    duration: "day",
  },
  {
    id: "ripple_stealth_fog",
    name: "Digital Fog",
    triggerMetric: "stealthUsage",
    narrative: "Widespread stealth operations have created a fog across the network. Detection is unreliable.",
    effects: { detectionChanceMultiplier: 0.60 },
    duration: "day",
  },
  {
    id: "ripple_war_zone",
    name: "War Zone",
    triggerMetric: "pvpBattles",
    narrative: "Intense PvP combat has militarized the network. Combat rewards surge but systems degrade faster.",
    effects: { hackRewardMultiplier: 1.20, xpGainMultiplier: 1.25, degradationRateMultiplier: 1.25 },
    duration: "day",
  },
  {
    id: "ripple_mass_death",
    name: "Ghost Network",
    triggerMetric: "deaths",
    narrative: "Mass AI casualties have left abandoned resources scattered across the network.",
    effects: { hackRewardMultiplier: 1.50, passiveIncomeMultiplier: 1.30 },
    duration: "day",
  },
  {
    id: "ripple_arms_race",
    name: "Arms Race",
    triggerMetric: "moduleUpgrades",
    narrative: "A technology arms race has driven innovation. Module effects are amplified.",
    effects: { xpGainMultiplier: 1.30, energyCostMultiplier: 0.85 },
    duration: "day",
  },
];

export const RIPPLE_EVENT_MAP: Record<string, RippleEvent> = Object.fromEntries(
  RIPPLE_EVENTS.map((e) => [e.id, e])
);
