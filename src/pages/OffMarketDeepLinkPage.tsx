import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import OffMarketPage from '@/pages/OffMarketPage';
import { pasOffMarketDeepLinkToe } from '@/lib/offMarket/acquisitie/radarFollowupDeepLink';

/**
 * Verwerkt queryparameters vóór OffMarketPage en de Acquisitieselectie hun
 * bestaande sessionStorage-state initialiseren. Daarna wordt de URL weer schoon,
 * zodat een latere tabwissel de deep-link niet opnieuw afdwingt.
 *
 * De tijdelijke key forceert ook een verse OffMarketPage wanneer de gebruiker
 * al in Off-Market stond en daarna vanuit een pushmelding opnieuw binnenkomt.
 */
export default function OffMarketDeepLinkPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const deepLinkToegepast = pasOffMarketDeepLinkToe(location.search);
  const paginaKey = deepLinkToegepast ? `deep-link:${location.search}` : 'off-market';

  useEffect(() => {
    if (!deepLinkToegepast) return;
    navigate(location.pathname, { replace: true });
  }, [deepLinkToegepast, location.pathname, navigate]);

  return <OffMarketPage key={paginaKey} />;
}
