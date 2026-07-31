// Concrete onderzoeksredenen per signaal, zodat de gebruiker in de rij ziet
// waarom een signaal onder "Onderzoeken" staat. Puur afgeleid uit de
// bestaande readiness-logica; geen nieuwe blokkadelogica.
import type { SignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';

export type OnderzoekReden =
  | 'eigenaarsonderzoek_ontbreekt'
  | 'geadresseerde_ontbreekt'
  | 'verzendadres_ontbreekt'
  | 'verzendadres_onvolledig';

export const ONDERZOEK_REDEN_LABEL: Record<OnderzoekReden, string> = {
  eigenaarsonderzoek_ontbreekt: 'Eigenaarsonderzoek ontbreekt',
  geadresseerde_ontbreekt: 'Geadresseerde ontbreekt',
  verzendadres_ontbreekt: 'Verzendadres ontbreekt',
  verzendadres_onvolledig: 'Verzendadres onvolledig',
};

/**
 * Bepaal welke concrete zaken nog onderzocht/aangevuld moeten worden.
 * Retourneert een lege lijst wanneer het signaal niet (meer) geblokkeerd is.
 */
export function bepaalOnderzoekRedenen(readiness: SignaalReadiness): OnderzoekReden[] {
  const uit: OnderzoekReden[] = [];
  const { fase, geadresseerden } = readiness;

  if (fase === 'onderzoek_nodig') {
    uit.push('eigenaarsonderzoek_ontbreekt');
  }
  if (fase === 'eigenaar_ontbreekt' || (fase === 'onderzoek_nodig' && geadresseerden.length === 0)) {
    if (geadresseerden.length === 0 && fase !== 'onderzoek_nodig') {
      uit.push('geadresseerde_ontbreekt');
    } else if (fase === 'eigenaar_ontbreekt') {
      uit.push('geadresseerde_ontbreekt');
    }
  }
  if (fase === 'adres_ontbreekt') {
    const zonderAdres = geadresseerden.filter(g => !g.verzendadres);
    const onvolledig = geadresseerden.filter(g => g.verzendadres && !g.volledigPostadres);
    if (zonderAdres.length > 0) uit.push('verzendadres_ontbreekt');
    if (onvolledig.length > 0) uit.push('verzendadres_onvolledig');
    if (uit.length === 0) uit.push('verzendadres_ontbreekt');
  }
  return uit;
}

/** Compacte samenvatting voor in de rij, bv. "Eigenaarsonderzoek ontbreekt · Verzendadres onvolledig". */
export function onderzoekRedenTekst(redenen: OnderzoekReden[]): string | null {
  if (redenen.length === 0) return null;
  return redenen.map(r => ONDERZOEK_REDEN_LABEL[r]).join(' · ');
}
