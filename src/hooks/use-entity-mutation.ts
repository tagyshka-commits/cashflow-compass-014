import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateSnapshot } from "@/hooks/use-snapshot";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];

/**
 * Generic create/update/delete for user-owned tables with automatic
 * snapshot invalidation and toast feedback. RLS scopes rows to the
 * signed-in user, so we do not need to filter user_id on update/delete
 * beyond the row id.
 */
export function useEntityMutation<T extends TableName>(
  table: T,
  labels: { create: string; update: string; remove: string },
) {
  const invalidate = useInvalidateSnapshot();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = () => supabase.from(table) as any;

  const create = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await tbl().insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(labels.create);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await tbl().update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(labels.update);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tbl().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(labels.remove);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}
