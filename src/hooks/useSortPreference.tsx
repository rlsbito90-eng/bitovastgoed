import { useCallback, useEffect, useState } from 'react';

const KEY_PREFIX = 'sort-pref:';

/**
 * Persisteert sorteer-keuze per module-key in localStorage.
 * Bij ongeldige opgeslagen waarde valt het terug op `defaultValue`.
 */
export function useSortPreference(moduleKey: string, defaultValue: string, validValues: string[]) {
  const storageKey = KEY_PREFIX + moduleKey;
  const [value, setValueState] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw && validValues.includes(raw)) return raw;
    } catch {
      /* ignore */
    }
    return defaultValue;
  });

  // Als validValues verandert en huidige waarde niet meer geldig is → reset.
  useEffect(() => {
    if (!validValues.includes(value)) setValueState(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validValues.join('|')]);

  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  return [value, setValue] as const;
}
