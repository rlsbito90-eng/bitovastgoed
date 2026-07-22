// Pure helpers voor de Acquisitieselectie-view (Fase 1.1).
// Wordt door AcquisitieSelectieTab gebruikt en apart getest.

import {
  ACTIE_SUBFILTER_LABEL,
  WERKBAK_LABEL,
  type ActieSubfilter,
  type Werkbak,
  type WerkbakView,
} from './werkbak';

// ---------------------------------------------------------------------
// SessionStorage-view: werkbak + subfilter
// ---------------------------------------------------------------------

export const WERKBAK_KEY = 'off-market-acq:werkbak';
export const SUBFILTER_KEY = 'off-market-acq:subfilter';
export const LEGACY_FILTER_KEY = 'off-market-acq:filter';

const GELDIGE_WERKBAK: WerkbakView[] = ['actie', 'wachten', 'afgehandeld', 'alles'];
const GELDIG_SUBFILTER: ActieSubfilter[] = [
  'alle', 'onderzoeken', 'brief_voorbereiden', 'printen_posten', 'opvolgen',
];

/** Vertaal de oude filterchip-waarde naar (werkbak, subfilter). */
export function migreerLegacyFilter(v: string | null): { werkbak: WerkbakView; subfilter: ActieSubfilter } {
  switch (v) {
    case 'alles': return { werkbak: 'alles', subfilter: 'alle' };
    case 'geblokkeerd': return { werkbak: 'actie', subfilter: 'onderzoeken' };
    case 'brief_voorbereiden': return { werkbak: 'actie', subfilter: 'brief_voorbereiden' };
    case 'printklaar': return { werkbak: 'actie', subfilter: 'printen_posten' };
    case 'opvolging': return { werkbak: 'actie', subfilter: 'opvolgen' };
    default: return { werkbak: 'actie', subfilter: 'alle' };
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
}

/**
 * Bepaalt de initiële view op basis van sessionStorage.
 * Geeft altijd een geldige combinatie terug; ongeldige waarden vallen
 * defensief terug op {actie, alle}.
 */
export function leesInitieleView(storage?: StorageLike): { werkbak: WerkbakView; subfilter: ActieSubfilter } {
  try {
    const s = storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    if (!s) return { werkbak: 'actie', subfilter: 'alle' };
    const wb = s.getItem(WERKBAK_KEY);
    const sf = s.getItem(SUBFILTER_KEY);
    if (wb && GELDIGE_WERKBAK.includes(wb as WerkbakView)) {
      return {
        werkbak: wb as WerkbakView,
        subfilter: sf && GELDIG_SUBFILTER.includes(sf as ActieSubfilter)
          ? (sf as ActieSubfilter)
          : 'alle',
      };
    }
    const legacy = s.getItem(LEGACY_FILTER_KEY);
    if (legacy) return migreerLegacyFilter(legacy);
  } catch { /* ignore */ }
  return { werkbak: 'actie', subfilter: 'alle' };
}

// ---------------------------------------------------------------------
// Verplaatsfeedback — pure diff-berekening
// ---------------------------------------------------------------------

export interface VorigeCtx {
  werkbak: Werkbak;
  subfilter: ActieSubfilter | null;
}

export interface VerplaatsToast {
  id: string;
  soort: 'werkbak' | 'subfilter';
  doelLabel: string;
}

/**
 * Bepaal welke signalen sinds `vorig` een zichtbare verplaatsing maakten
 * die door een expliciete gebruikersmutatie in deze sessie is veroorzaakt.
 *
 * - Als `vorig` `null` is (initiële laadactie), retourneer lege lijst.
 * - Signalen zonder recente mutatie binnen `ttlMs` worden overgeslagen
 *   (achtergrondrefresh of externe wijziging).
 * - Wisseling van hoofdwerkbak → `soort='werkbak'` met werkbak-label.
 * - Zelfde werkbak='actie' met andere subfilter → `soort='subfilter'`
 *   met subfilter-label.
 */
export function bepaalVerplaatsToasts(input: {
  vorig: Map<string, VorigeCtx> | null;
  huidig: Map<string, VorigeCtx>;
  recenteMutaties: Map<string, number>;
  nu: number;
  ttlMs?: number;
}): VerplaatsToast[] {
  const { vorig, huidig, recenteMutaties, nu, ttlMs = 7000 } = input;
  if (!vorig) return [];
  const out: VerplaatsToast[] = [];
  for (const [id, oud] of vorig.entries()) {
    const nieuw = huidig.get(id);
    if (!nieuw) continue;
    const werkbakChanged = nieuw.werkbak !== oud.werkbak;
    const subfilterChanged =
      nieuw.werkbak === 'actie' && oud.werkbak === 'actie'
      && nieuw.subfilter !== oud.subfilter;
    if (!werkbakChanged && !subfilterChanged) continue;
    const mutAt = recenteMutaties.get(id);
    if (!mutAt || nu - mutAt > ttlMs) continue;

    if (werkbakChanged) {
      out.push({ id, soort: 'werkbak', doelLabel: WERKBAK_LABEL[nieuw.werkbak] });
    } else {
      const label = nieuw.subfilter
        ? ACTIE_SUBFILTER_LABEL[nieuw.subfilter]
        : WERKBAK_LABEL.actie;
      out.push({ id, soort: 'subfilter', doelLabel: label });
    }
  }
  return out;
}

/**
 * Extraheer signaal-id's uit de `variables` van een react-query mutatie.
 * Accepteert `{ id }`, `{ signaal_id }`, `{ signaalId }` en arrays.
 */
export function extraheerSignaalIds(vars: unknown): string[] {
  if (vars == null) return [];
  if (Array.isArray(vars)) return vars.flatMap(extraheerSignaalIds);
  if (typeof vars !== 'object') return [];
  const rec = vars as Record<string, unknown>;
  const out: string[] = [];
  for (const key of ['signaal_id', 'signaalId', 'id']) {
    const v = rec[key];
    if (typeof v === 'string' && v.length > 0) out.push(v);
  }
  return out;
}
