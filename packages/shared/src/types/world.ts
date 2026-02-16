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
}
