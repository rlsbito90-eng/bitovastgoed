import type { ProfielRoute } from './rolMandaatAdapter';
import type { RendementsOordeel } from './rendementsOordeel';

/** Een inhoudelijk voorstel vraagt vastgoedbewijs. Budget of alleen landelijke regio
 * mag niet als sterke vastgoedmatch worden gepresenteerd.
 * Deze indeling is een presentatieprioriteit, nooit een nieuwe harde uitsluiting.
 */
export type VoorstelPrioriteit = 'kansrijk'|'controleren'|'niet_aanbevolen';

export function bepaalVoorstelPrioriteit(
  route: ProfielRoute,
  rendement: RendementsOordeel,
): VoorstelPrioriteit {
  if (route.kwalificatie === 'afwijkend') return 'niet_aanbevolen';
  const bewijs = route.bewijs;
  if (!bewijs) return 'niet_aanbevolen';

  const vastgoedBewijs = bewijs.vastgoedtype || bewijs.subcategorie;
  const strategieBewijs = bewijs.dealtype;
  const plaatsBewijs = bewijs.locatie;
  const financieelOnzeker = rendement.status === 'controle' || rendement.status === 'indicatief_lager';

  // Niet vergelijken op alleen vraagprijs, algemene landelijke regio of één breed dealtype.
  if (!vastgoedBewijs && !(strategieBewijs && plaatsBewijs)) return 'niet_aanbevolen';

  // Ook bij een sterke basis: geen positieve kwalificatie zolang de methode of
  // gegevens onduidelijk zijn. Een zwakkere route blijft handmatig bereikbaar.
  if (vastgoedBewijs && plaatsBewijs && route.kwalificatie === 'passend' && !financieelOnzeker) {
    return 'kansrijk';
  }
  return 'controleren';
}

export function rangVoorstelPrioriteit(p:VoorstelPrioriteit):number {
  return p==='kansrijk'?3:p==='controleren'?2:1;
}
