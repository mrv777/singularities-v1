import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { PlayerResponse } from "@singularities/shared";

export function usePlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<PlayerResponse>({
    queryKey: ["player", "me"],
    queryFn: () => api.getMe(),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
