import { useEffect, useRef, useCallback } from 'react';

/**
 * Dirty-state bescherming voor modals/drawers/formulieren.
 *
 * Gebruik:
 *   const guard = useDirtyGuard(isDirty);
 *   // bij sluiten:
 *   if (await guard.confirmDiscard()) onOpenChange(false);
 *
 * Toont een native confirm bij wegklikken én bij browser refresh/close.
 * Geen externe dialog state nodig — minimaal invasief voor bestaande dialogs.
 */
export function useDirtyGuard(isDirty: boolean) {
  const dirtyRef = useRef(isDirty);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      // Moderne browsers tonen hun eigen tekst, returnValue is verplicht voor compat.
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const confirmDiscard = useCallback((): boolean => {
    if (!dirtyRef.current) return true;
    if (typeof window === 'undefined') return true;
    return window.confirm(
      'Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je deze wilt verwerpen?'
    );
  }, []);

  return { confirmDiscard, isDirty };
}
