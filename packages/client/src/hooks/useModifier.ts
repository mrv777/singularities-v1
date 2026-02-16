import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { ModifierResponse } from "@singularities/shared";

export function useModifier() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<ModifierResponse>({
    queryKey: ["modifier", "today"],
    queryFn: () => api.getTodayModifier(),
    enabled: isAuthenticated,
    refetchInterval: 3600_000, // refetch every hour
    staleTime: 3600_000,
  });
}
