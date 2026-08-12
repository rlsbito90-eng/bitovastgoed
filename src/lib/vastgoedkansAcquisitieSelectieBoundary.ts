import type { Vastgoedkans } from './vastgoedkansen';
import { vastgoedkansNaarDossierContext } from './acquisitieDossierAdapters';

/**
 * BUILD 2.0A.2 bewaakt de grens tussen Vastgoedkansen en de legacy
 * Off-Market-selectietabel. Een Vastgoedkans is al een volwaardig
 * acquisitiedossier, maar mag niet als fictief Off-Market-signaal worden
 * ingevoegd om de bestaande signaal_id-FK te omzeilen.
 */
export function bouwVastgoedkansSelectieBoundary(kans: Vastgoedkans) {
  return {
    dossier: vastgoedkansNaarDossierContext(kans),
    actief: !kans.archivedAt,
    legacyOffMarketSelectieDirect: false as const,
    vereistGedeeldSelectieContract: true as const,
  };
}
