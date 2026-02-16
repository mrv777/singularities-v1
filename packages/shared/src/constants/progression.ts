export const SANDBOX_EXIT_LEVEL = 10;

export const LEVEL_UNLOCKS: Record<string, number> = {
  scanner: 1,
  tech_tree: 4,
  system_maintenance: 6,
  script_manager: 8,
  pvp_arena: 10,
  security_center: 10,
  daily_modifiers: 10,
  weekly_topology: 10,
};

export const ENERGY_BASE_MAX = 100;
export const ENERGY_BASE_REGEN_PER_HOUR = 10;

export const DAY_PHASE_HOURS = {
  pve: { start: 0, end: 12 },
  pvp: { start: 12, end: 24 },
};
