import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: (e: React.FormEvent) => void;
  submitting?: boolean;
  submitLabel?: string;
  children: ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  submitLabel = "Save",
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display italic text-2xl">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground text-sm">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-3">{children}</div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-md bg-surface-2 border border-border text-sm hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-foreground text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Saving…" : submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
