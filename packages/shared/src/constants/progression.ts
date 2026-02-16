export const SANDBOX_EXIT_LEVEL = 10;

export const LEVEL_UNLOCKS: Record<string, number> = {
  scanner: 1,
  tech_tree: 4,
  system_maintenance: 6,
  script_manager: 8,
  pvp_arena: 10,
  security_center: 10,
  daily_modifiers: 10,
  network_stats: 10,
};

// Systems that are blocked while in sandbox mode
const SANDBOX_BLOCKED: string[] = ["pvp_arena", "security_center"];

export const ENERGY_BASE_MAX = 100;
export const ENERGY_BASE_REGEN_PER_HOUR = 120; // 2/min
export const ENERGY_REGEN_PER_LEVEL = 6; // +0.1/min per level

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
