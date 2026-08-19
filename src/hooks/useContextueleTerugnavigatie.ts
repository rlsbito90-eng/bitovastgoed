import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getCrmDetailModule,
  leesCrmDetailOrigin,
  leesCrmReturnContext,
} from '@/lib/crmReturnContext';

/**
 * Centrale regel voor detail -> herkomst-navigatie.
 *
 * Prioriteit:
 * 1. expliciete cross-module return-context;
 * 2. stabiele origin van de huidige detailketen;
 * 3. echte browser-history als legacy fallback;
 * 4. modulefallback bij een directe deep-link.
 */
export function useContextueleTerugnavigatie(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnContext = leesCrmReturnContext(location.state);
  const module = getCrmDetailModule(location.pathname);
  const originPath = module ? leesCrmDetailOrigin(module) : null;

  return useCallback(() => {
    if (returnContext) {
      navigate(returnContext.path, { replace: true });
      return;
    }

    if (originPath) {
      navigate(originPath, { replace: true });
      return;
    }

    const idx = typeof window !== 'undefined'
      ? (window.history.state as { idx?: unknown } | null)?.idx
      : null;

    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }

    navigate(fallback, { replace: true });
  }, [fallback, navigate, originPath, returnContext]);
}
