// Veilige opschoon-detectie voor testconcepten in off-market brieven.
// Verstuurde brieven worden NOOIT als opschoonkandidaat gemarkeerd.
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { Taak } from '@/data/mock-data';
import { groepeerBrievenPerGeadresseerde, STAP_VOLGORDE, type CampagneStap } from './groepering';

const OPEN_TAAK_STATUSSEN = new Set(['open', 'in_uitvoering', 'wacht_op_reactie']);

export interface OpschoonKandidaat {
  brief: OffMarketBrief;
  geadresseerdeNaam: string;
  campagneStap: CampagneStap;
  reden: string;
}

/**
 * Een concept is alleen opschoonkandidaat wanneer:
 *  - status === 'concept'
 *  - geen verzonden_op
 *  - niet de actieve (= meest recente) conceptversie binnen
 *    (geadresseerde, campagnestap)
 *  - geen gekoppelde open opvolgtaak voor het signaal
 *  - niet al gearchiveerd
 */
export function veiligeOpschoonkandidaten(
  brieven: OffMarketBrief[],
  taken: Taak[],
): OpschoonKandidaat[] {
  const heeftOpenTaakVoorSignaal = new Map<string, boolean>();
  for (const t of taken) {
    if (!t.offMarketSignaalId) continue;
    if (!OPEN_TAAK_STATUSSEN.has(t.status)) continue;
    if ((t as any).softDeletedAt) continue;
    heeftOpenTaakVoorSignaal.set(t.offMarketSignaalId, true);
  }

  const out: OpschoonKandidaat[] = [];
  // Groepeer per signaal zodat we per-signaal kunnen redeneren.
  const perSignaal = new Map<string, OffMarketBrief[]>();
  for (const b of brieven) {
    if (b.archived_at) continue;
    const arr = perSignaal.get(b.signaal_id) ?? [];
    arr.push(b);
    perSignaal.set(b.signaal_id, arr);
  }

  for (const [signaalId, lijst] of perSignaal.entries()) {
    const groepen = groepeerBrievenPerGeadresseerde(lijst);
    const heeftOpenTaak = heeftOpenTaakVoorSignaal.get(signaalId) ?? false;
    for (const g of groepen) {
      for (const stap of STAP_VOLGORDE) {
        const s = g.stappen[stap];
        for (const oud of s.oudereConcepten) {
          // Verstuurde brieven kunnen hier niet voorkomen (filter al toegepast
          // in groepering), maar defensief dubbelchecken.
          if (oud.status === 'verstuurd') continue;
          if (oud.verzonden_op) continue;
          if (oud.archived_at) continue;
          out.push({
            brief: oud,
            geadresseerdeNaam: g.naam,
            campagneStap: stap,
            reden: heeftOpenTaak
              ? 'Ouder concept; nieuwere conceptversie aanwezig voor dezelfde stap (open opvolgtaak blijft behouden)'
              : 'Ouder concept; nieuwere conceptversie aanwezig voor dezelfde stap',
          });
        }
      }
    }
  }
  return out;
}
