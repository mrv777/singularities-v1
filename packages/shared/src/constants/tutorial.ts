export const TUTORIAL_STEPS = [
  "boot",
  "scan",
  "hack",
  "upgrade",
  "equip",
  "done",
] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

/** Map tutorial step → which network node to highlight (null = no highlight) */
export const TUTORIAL_HIGHLIGHT_NODE: Record<TutorialStep, string | null> = {
  boot: null,
  scan: "scanner",
  hack: "scanner",
  upgrade: "tech_tree",
  equip: "security_center",
  done: null,
};

/** Map tutorial step → directive text shown in the hint bar */
export const TUTORIAL_DIRECTIVES: Record<TutorialStep, string | null> = {
  boot: null,
  scan: "Scan the network to find infiltration targets",
  hack: "Select a target and start an infiltration",
  upgrade: "Use your credits to unlock a module in the Tech Tree",
  equip: "Equip your new module in a loadout",
  done: null,
};

/** Map tutorial step → which modal to open when user clicks the action button */
export const TUTORIAL_MODAL: Record<TutorialStep, string | null> = {
  boot: null,
  scan: "scanner",
  hack: "scanner",
  upgrade: "tech_tree",
  equip: "security_center",
  done: null,
};

/** Validate forward-only progression — returns true if moving from `current` to `next` is valid */
export function isValidTutorialProgression(current: string, next: string): boolean {
  const currentIdx = TUTORIAL_STEPS.indexOf(current as TutorialStep);
  const nextIdx = TUTORIAL_STEPS.indexOf(next as TutorialStep);
  if (currentIdx === -1 || nextIdx === -1) return false;
  return nextIdx > currentIdx;
}
