import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchSnapshot, type FinancialSnapshot } from "@/lib/snapshot";

export function useSnapshot() {
  const { user } = useAuth();
  const [snap, setSnap] = useState<FinancialSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const s = await fetchSnapshot(user.id);
      setSnap(s);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { snapshot: snap, loading, refresh };
}
