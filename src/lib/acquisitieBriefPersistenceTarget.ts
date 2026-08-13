import type { AcquisitieDossierContext } from './acquisitieDossierContext';

export type AcquisitieBriefPersistenceTarget =
  | { signaal_id: string; vastgoedkans_id: null; dossier_type: 'off_market_signaal' }
  | { signaal_id: null; vastgoedkans_id: string; dossier_type: 'vastgoedkans' };

/**
 * Enige vertaling van een gedeeld acquisitiedossier naar de brief-persistentielaag.
 * Levert bewust exact één dossier-ID op; nooit een fake Off-Market-signaal voor een Vastgoedkans.
 */
export function acquisitieDossierNaarBriefPersistenceTarget(
  dossier: Pick<AcquisitieDossierContext, 'bronType' | 'bronId'>,
): AcquisitieBriefPersistenceTarget {
  const bronId = dossier.bronId.trim();
  if (!bronId) throw new Error('Briefpersistentie vereist een bron-ID.');

  if (dossier.bronType === 'off_market_signaal') {
    return { signaal_id: bronId, vastgoedkans_id: null, dossier_type: 'off_market_signaal' };
  }

  return { signaal_id: null, vastgoedkans_id: bronId, dossier_type: 'vastgoedkans' };
}
