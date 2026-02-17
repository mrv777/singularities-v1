import { useAuthStore } from "@/stores/auth";

export type UITier = 1 | 2 | 3;

export function useUITier(): { tier: UITier; tierClass: string } {
  const level = useAuthStore((s) => s.player?.level ?? 1);

  let tier: UITier;
  if (level >= 20) {
    tier = 3;
  } else if (level >= 10) {
    tier = 2;
  } else {
    tier = 1;
  }

  return {
    tier,
    tierClass: `ui-tier-${tier}`,
  };
}
