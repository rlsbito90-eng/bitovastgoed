import { useEffect, useRef } from 'react';
import { useDirtyGuard } from './useDirtyGuard';

/**
 * Form-niveau dirty bescherming.
 *
 * Snapshot `value` op het moment dat het dialog/formulier opent en vergelijkt
 * via JSON-serialisatie. Geeft een gewrapte `guardedOnOpenChange` terug die bij
 * sluiten met wijzigingen om bevestiging vraagt.
 *
 * Gebruik:
 *   const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);
 *   <Dialog open={open} onOpenChange={guardedOnOpenChange}> ... </Dialog>
 */
export function useFormDirtyGuard<T>(
  open: boolean,
  value: T,
  onOpenChange: (open: boolean) => void,
) {
  const baselineRef = useRef<string>('');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      try { baselineRef.current = JSON.stringify(value); } catch { baselineRef.current = ''; }
    }
    wasOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  let current = '';
  try { current = JSON.stringify(value); } catch { current = ''; }
  const isDirty = open && baselineRef.current !== '' && current !== baselineRef.current;

  const { confirmDiscard } = useDirtyGuard(isDirty);

  const guardedOnOpenChange = (next: boolean) => {
    if (open && !next && isDirty) {
      if (!confirmDiscard()) return;
    }
    onOpenChange(next);
  };

  return { isDirty, guardedOnOpenChange };
}
