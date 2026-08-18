import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Centrale regel voor detail -> lijst-navigatie.
 *
 * `Terug` betekent terug naar de echte vorige browser/app-entry, zodat tab,
 * werkbak, filters, sortering, selectie en scrollcontext die op die entry
 * leefden niet worden vervangen door een nieuwe standaardroute. Alleen bij een
 * directe deep-link zonder bruikbare app-history wordt de modulefallback gebruikt.
 */
export function useContextueleTerugnavigatie(fallback: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = typeof window !== 'undefined'
      ? (window.history.state as { idx?: unknown } | null)?.idx
      : null;

    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }

    navigate(fallback);
  }, [fallback, navigate]);
}
