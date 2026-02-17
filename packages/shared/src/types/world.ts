export interface DailyModifier {
  id: number;
  date: string;
  modifierId: string;
  modifierData: Record<string, unknown>;
}

export interface Season {
  id: number;
  name: string;
  startedAt: string;
  endsAt: string;
  isActive: boolean;
  metaModules: Record<string, unknown> | null;
  catchUpConfig: Record<string, unknown> | null;
}

export interface WeeklyTopology {
  id: number;
  weekStart: string;
  weekEnd: string;
  boostedNode: string | null;
  boostEffect: { label: string; description: string; modifiers: Record<string, number> } | null;
  hinderedNode: string | null;
  hindranceEffect: { label: string; description: string; modifiers: Record<string, number> } | null;
  specialNode: { type: string; name: string; active: boolean } | null;
}

export interface WorldEvent {
  id: number;
  date: string;
  eventType: string;
  triggerData: Record<string, unknown> | null;
  effectData: Record<string, number> | null;
  narrative: string | null;
}

export interface PendingDecision {
  id: string;
  playerId: string;
  decisionId: string;
  triggeredBy: string;
  createdAt: string;
}

export interface SeasonLeaderboardEntry {
  rank: number;
  playerId: string;
  aiName: string;
  level: number;
  reputation: number;
}

export interface NetworkStats {
  totalPlayers: number;
  activePlayers: number;
  hacksToday: number;
  pvpBattlesToday: number;
  deathsToday: number;
  activeWorldEvents: WorldEvent[];
  season: Season | null;
}

export interface MutationResult {
  success: boolean;
  mutation: string | null;
  message: string;
}

export interface AlignmentPerks {
  reputationBonus: number;
  creditBonus: number;
  defenseBonus: number;
  attackBonus: number;
  stealthBonus: number;
  dataDrainBonus: number;
}
