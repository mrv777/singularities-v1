export interface RippleThreshold {
  metric: string;
  threshold: number;
  description: string;
}

export const RIPPLE_THRESHOLDS: RippleThreshold[] = [
  { metric: "totalHacks", threshold: 100, description: "High hacking activity detected" },
  { metric: "stealthUsage", threshold: 50, description: "Widespread stealth operations" },
  { metric: "pvpBattles", threshold: 30, description: "Intense PvP combat activity" },
  { metric: "deaths", threshold: 10, description: "Mass AI casualties" },
  { metric: "moduleUpgrades", threshold: 50, description: "Technology arms race detected" },
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
