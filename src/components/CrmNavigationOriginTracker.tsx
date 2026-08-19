import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  bewaarCrmDetailOrigin,
  bepaalNieuweCrmDetailOrigin,
} from '@/lib/crmReturnContext';

type RouteSnapshot = {
  pathname: string;
  fullPath: string;
};

/**
 * Houd app-breed bij vanaf welke route een detailketen is geopend.
 *
 * Dit component rendert niets. Het blijft boven de CRM-routes gemount, zodat
 * ook programmatic navigatie (rij-clicks, knoppen, kaart-popups, etc.) dezelfde
 * betrouwbare terugroute krijgt als gewone links.
 */
export default function CrmNavigationOriginTracker() {
  const location = useLocation();
  const vorigeRef = useRef<RouteSnapshot | null>(null);

  useEffect(() => {
    const huidig: RouteSnapshot = {
      pathname: location.pathname,
      fullPath: `${location.pathname}${location.search}${location.hash}`,
    };
    const vorig = vorigeRef.current;

    if (vorig) {
      const origin = bepaalNieuweCrmDetailOrigin({
        vorigePathname: vorig.pathname,
        vorigeVolledigePad: vorig.fullPath,
        huidigePathname: huidig.pathname,
      });
      if (origin) bewaarCrmDetailOrigin(origin.module, origin.path);
    }

    vorigeRef.current = huidig;
  }, [location.pathname, location.search, location.hash]);

  return null;
}
