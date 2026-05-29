// Wrappers voor shadcn Dialog/Sheet die dirty-state beschermen.
// Onderschept een poging tot sluiten (overlay-klik, Esc, X) en vraagt
// bevestiging als er niet-opgeslagen wijzigingen zijn.
import type { ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Sheet } from '@/components/ui/sheet';
import { useDirtyGuard } from '@/hooks/useDirtyGuard';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDirty: boolean;
  children: ReactNode;
};

export function GuardedDialog({ open, onOpenChange, isDirty, children }: Props) {
  const { confirmDiscard } = useDirtyGuard(isDirty);
  const handle = (next: boolean) => {
    if (open && !next && isDirty) {
      if (!confirmDiscard()) return;
    }
    onOpenChange(next);
  };
  return <Dialog open={open} onOpenChange={handle}>{children}</Dialog>;
}

export function GuardedSheet({ open, onOpenChange, isDirty, children }: Props) {
  const { confirmDiscard } = useDirtyGuard(isDirty);
  const handle = (next: boolean) => {
    if (open && !next && isDirty) {
      if (!confirmDiscard()) return;
    }
    onOpenChange(next);
  };
  return <Sheet open={open} onOpenChange={handle}>{children}</Sheet>;
}
