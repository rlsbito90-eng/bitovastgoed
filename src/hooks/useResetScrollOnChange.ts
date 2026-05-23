import { useEffect, useRef, RefObject } from 'react';

/**
 * Reset scrolltop van een container telkens een waarde (zoals actieve tab) wijzigt.
 * Gebruik: pas ref op de scroll-container toe en geef hier de actieve tab-key.
 */
export function useResetScrollOnChange(value: unknown): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = 0;
    }
  }, [value]);
  return ref;
}
