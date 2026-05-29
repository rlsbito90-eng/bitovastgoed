import { useEffect, useMemo, useRef } from 'react';
import { useDirtyGuard } from './useDirtyGuard';

/**
 * Form-niveau dirty bescherming.
 *
 * Snapshot `value` op het moment dat het dialog/formulier opent en vergelijkt
 * via JSON-serialisatie. Geeft een gewrapte `guardedOnOpenChange` terug die bij
 * sluiten met wijzigingen om bevestiging vraagt.
 *
 * Performance: `JSON.stringify(value)` wordt gememoized op referentie van `value`
 * om kosten bij grote form-objecten te beperken.
 */
export function useFormDirtyGuard<T>(
  open: boolean,
  value: T,
  onOpenChange: (open: boolean) => void,
) {
  const baselineRef = useRef<string>('');
  const wasOpenRef = useRef(false);

  const current = useMemo(() => {
    try { return JSON.stringify(value); } catch { return ''; }
  }, [value]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      baselineRef.current = current;
    }
    wasOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
