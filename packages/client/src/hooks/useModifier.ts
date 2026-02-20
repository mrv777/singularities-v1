import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { ModifierResponse, ModifierEffect } from "@singularities/shared";

const DEFAULT_EFFECTS: ModifierEffect = {
  energyCostMultiplier: 1,
  hackRewardMultiplier: 1,
  degradationRateMultiplier: 1,
  repairCostMultiplier: 1,
  passiveIncomeMultiplier: 1,
  detectionChanceMultiplier: 1,
  xpGainMultiplier: 1,
  heatDecayMultiplier: 1,
};

export function useModifier() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery<ModifierResponse>({
    queryKey: ["modifier", "today"],
    queryFn: () => api.getTodayModifier(),
    enabled: isAuthenticated,
    refetchInterval: 3600_000, // refetch every hour
    staleTime: 3600_000,
  });

  const effects: ModifierEffect = useMemo(
    () => query.data?.combinedEffects ?? DEFAULT_EFFECTS,
    [query.data?.combinedEffects],
  );

  const applyCost = useCallback(
    (baseCost: number, multiplierKey: keyof ModifierEffect): number =>
      Math.round(baseCost * (effects[multiplierKey] ?? 1)),
    [effects],
  );

  return { ...query, effects, applyCost };
}
