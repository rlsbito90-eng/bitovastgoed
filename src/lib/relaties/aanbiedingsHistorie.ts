/**
 * Relatie ↔ object: daadwerkelijk voorgesteld aanbod onderscheiden van een
 * interne match. Alleen expliciete CRM-registraties als bewijs gebruiken.
 * Een e-mail of contactmoment met een object-id alleen is geen bewijs
 * dat het object is aangeboden.
 */
import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';

export type AanbiedingBewijs = 'expliciet' | 'fase_zonder_datum' | 'niet_geregistreerd';

export interface AanbiedingHistorieRij {
  kandidaat: PipelineKandidaat;
  bewijs: AanbiedingBewijs;
  /** Eerste gedocumenteerde toezending. Geen datum afleiden uit kandidaat-aanmaak. */
  eersteAanbieddatum?: string;
  /** Alle expliciet vastgelegde toezendmomenten. */
  momenten: Array<{ datum: string; soort: 'teaser' | 'informatie' }>;
}

const geldigDatum = (datum?: string): datum is string =>
  !!datum && /^\d{4}-\d{2}-\d{2}/.test(datum);
const isAanbiedMoment = (m: ContactMoment) =>
  m.direction === 'uitgaand' &&
  (m.type === 'teaser_verstuurd' || m.type === 'informatie_gedeeld');

export function aanbodHistorieVoorRelatie(
  kandidaten: readonly PipelineKandidaat[],
  contactmomenten: readonly ContactMoment[],
): AanbiedingHistorieRij[] {
  return kandidaten.map(k => {
    const gebeurtenissen = contactmomenten.filter(m =>
      m.relatieId === k.relatieId &&
      m.objectId === k.objectId &&
      isAanbiedMoment(m)
    );
    const momenten: AanbiedingHistorieRij['momenten'] = [];
    if (geldigDatum(k.teaserVerstuurdOp))
      momenten.push({ datum: k.teaserVerstuurdOp, soort: 'teaser' });
    if (geldigDatum(k.informatieGedeeldOp))
      momenten.push({ datum: k.informatieGedeeldOp, soort: 'informatie' });
    for (const m of gebeurtenissen) {
      if (!geldigDatum(m.momentDate)) continue;
      momenten.push({
        datum: m.momentDate,
        soort: m.type === 'teaser_verstuurd' ? 'teaser' : 'informatie',
      });
    }
    const uniekeMomenten = [...new Map(
      momenten.map(m => [m.soort+':'+m.datum, m] as const)
    ).values()].sort((a,b)=>a.datum.localeCompare(b.datum));

    const expliciet = k.teaserVerstuurd ||
      k.informatieGedeeld ||
      gebeurtenissen.length > 0 ||
      uniekeMomenten.length > 0;
    const faseTeaser = k.pipelineFase === 'teaser_verstuurd' ||
      k.pipelineFase === 'informatie_gedeeld';

    const bewijs: AanbiedingBewijs = expliciet ? 'expliciet'
      : faseTeaser ? 'fase_zonder_datum'
      : 'niet_geregistreerd';
    return {
      kandidaat:k,
      bewijs,
      eersteAanbieddatum:uniekeMomenten[0]?.datum,
      momenten:uniekeMomenten,
    };
  }).sort((a,b) =>
    (b.eersteAanbieddatum ?? b.kandidaat.createdAt ?? '')
      .localeCompare(a.eersteAanbieddatum ?? a.kandidaat.createdAt ?? '')
  );
}

export function isAlsAangebodenGeregistreerd(rij: AanbiedingHistorieRij):boolean {
  return rij.bewijs === 'expliciet' || rij.bewijs === 'fase_zonder_datum';
}
