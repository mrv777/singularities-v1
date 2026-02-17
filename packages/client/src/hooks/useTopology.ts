import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useGameStore } from "@/stores/game";
import type { TopologyResponse } from "@singularities/shared";
import { useEffect } from "react";

export function useTopology() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setTopology = useGameStore((s) => s.setTopology);

  const query = useQuery<TopologyResponse>({
    queryKey: ["topology"],
    queryFn: () => api.getTopology(),
    enabled: isAuthenticated,
    refetchInterval: 3600_000,
    staleTime: 3600_000,
  });

  // Sync into game store so NetworkMap and other consumers still work
  useEffect(() => {
    if (query.data) {
      setTopology(query.data.topology);
    }
  }, [query.data, setTopology]);

  return query;
}
