import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchSnapshot, type FinancialSnapshot } from "@/lib/snapshot";

export const snapshotKey = (userId: string | undefined) => ["snapshot", userId] as const;

export function useSnapshot() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<FinancialSnapshot>({
    queryKey: snapshotKey(user?.id),
    queryFn: () => fetchSnapshot(user!.id),
    enabled: !!user,
    staleTime: 15_000,
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["snapshot"] });
  }, [qc]);

  return {
    snapshot: query.data ?? null,
    loading: query.isLoading,
    refresh,
  };
}

export function useInvalidateSnapshot() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ["snapshot"] });
  }, [qc]);
}
