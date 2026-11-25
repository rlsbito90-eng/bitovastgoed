import { RISICO_CATEGORIEEN, type Risicovoorkeur } from '../relaties/risicovoorkeuren';

export interface ObjectRisicoInput {
  leegstandPct?: number | null;
  transformatiePotentie?: boolean | null;
}

/** Existing object fields are indications, not verified risk facts.
 * A default verhuurStatus='leeg' or a missing value must never exclude a buyer.
 */
export function beoordeelRisicovoorkeuren(
  object: ObjectRisicoInput, relatieId: string, voorkeuren: readonly Risicovoorkeur[],
): string[] {
  const controles: string[] = [];
  for (const v of voorkeuren) {
    if (v.relatieId !== relatieId) continue;
    const label = RISICO_CATEGORIEEN.find(x => x.waarde === v.risicotype)?.label;
    if (!label) continue;
    const signaal = v.risicotype === 'leegstand' && typeof object.leegstandPct === 'number' &&
      Number.isFinite(object.leegstandPct) && object.leegstandPct > 0 && object.leegstandPct <= 100
      ? `${object.leegstandPct.toLocaleString('nl-NL')}% leegstand geregistreerd`
      : v.risicotype === 'transformatie' && object.transformatiePotentie === true
        ? 'transformatiepotentie geregistreerd' : null;
    if (v.bereidheid === 'accepteert') {
      if (signaal && !(v.bevestigd && v.bron?.trim())) {
        controles.push(`${label}: ${signaal}; acceptatie nog niet bevestigd`);
      }
      continue;
    }
    const bevestigd = v.bevestigd && !!v.bron?.trim();
    const houding = v.bereidheid === 'sluit_uit' ? 'uitsluiting' : 'acceptatie onder voorwaarden';
    controles.push(`${label}: ${bevestigd ? 'bevestigde' : 'onbevestigde'} ${houding}; ${signaal ?? 'objectrisico nog niet vastgesteld'}${v.toelichting?.trim() ? ' — ' + v.toelichting.trim() : ''}. Handmatig toetsen.`);
  }
  return controles;
}
