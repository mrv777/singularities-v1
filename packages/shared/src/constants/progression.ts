import { PROGRESSION_BALANCE } from "./balance.js";

export const SANDBOX_EXIT_LEVEL = PROGRESSION_BALANCE.sandboxExitLevel;

export const LEVEL_UNLOCKS: Record<string, number> = {
  ...PROGRESSION_BALANCE.unlockLevels,
};

// Systems that are blocked while in sandbox mode
const SANDBOX_BLOCKED: string[] = ["pvp_arena", "security_center"];

export const ENERGY_BASE_MAX = 130;
export const ENERGY_BASE_REGEN_PER_HOUR = 360; // 6/min
export const ENERGY_REGEN_PER_LEVEL = 8; // +0.13/min per level

export function getUnlockedSystems(level: number, inSandbox: boolean): string[] {
  const unlocked: string[] = [];
  for (const [system, reqLevel] of Object.entries(LEVEL_UNLOCKS)) {
    if (level >= reqLevel) {
      if (inSandbox && SANDBOX_BLOCKED.includes(system)) continue;
      unlocked.push(system);
    }
  }
  return unlocked;
}

export const DAY_PHASE_HOURS = {
  pve: { start: 0, end: 12 },
  pvp: { start: 12, end: 24 },
};
