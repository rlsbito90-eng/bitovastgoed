import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import {
  bouwProductiekernPrintbatchModellen,
  indexeerProductieNummersPerSignaal,
} from '@/lib/offMarket/acquisitie/productiekernPrintbatchOverzicht';
import type { ProductieNummersVoorSignaal } from '@/lib/offMarket/acquisitie/productiekernPrintbatchOverzicht';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const MAX_BATCHES_IN_SELECTIE = 50;

/**
 * Eén gedeelde read-only projectie voor BAT-overzicht, BR/BAT-zoekbaarheid en
 * nummerbadges in de bestaande Acquisitieselectie. Er wordt niets gemuteerd.
 */
export function useProductiekernSelectieOverzicht(
  brieven: readonly OffMarketBrief[],
  signalen: readonly OffMarketSignaal[],
) {
  const lezen = useMemo(
    () => maakStandaardProductiekernBrowserLeesSamenstelling(),
    [],
  );
  const formeleBriefIds = useMemo(() => brieven
    .filter((brief) => brief.status === 'definitief'
      && Boolean(brief.briefnummer?.trim())
      && Boolean(brief.selectie_id?.trim()))
    .map((brief) => brief.id)
    .sort(), [brieven]);
  const basisNummersPerSignaal = useMemo<Map<string, ProductieNummersVoorSignaal>>(() => {
    const briefnummersPerSignaal = new Map<string, Set<string>>();
    for (const brief of brieven) {
      const briefnummer = brief.briefnummer?.trim();
      if (!briefnummer) continue;
      const bestaand = briefnummersPerSignaal.get(brief.signaal_id) ?? new Set<string>();
      bestaand.add(briefnummer);
      briefnummersPerSignaal.set(brief.signaal_id, bestaand);
    }
    return new Map([...briefnummersPerSignaal].map(([signaalId, briefnummers]) => [signaalId, {
      briefnummers: [...briefnummers].sort(),
      batchnummers: [],
    }]));
  }, [brieven]);

  const query = useQuery({
    queryKey: [
      'off-market-acquisitie-productiekern',
      'selectie-productie-overzicht',
      formeleBriefIds,
    ],
    enabled: lezen.activatie.lezenActief && formeleBriefIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const [formeleBrieven, alleVersies] = await Promise.all([
        lezen.bulkRepository.haalBrievenOpIds(formeleBriefIds),
        lezen.bulkRepository.haalBriefversiesOpBriefIds(formeleBriefIds),
      ]);

      const briefPerId = new Map(formeleBrieven.map((brief) => [brief.id, brief]));
      const aantalActieveVersiesPerBrief = new Map<string, number>();
      const actieveVersies = alleVersies.filter((versie) => {
        const brief = briefPerId.get(versie.briefId);
        const isActueel = Boolean(
          brief
          && brief.actieveVersie === versie.versienummer
          && (versie.status === 'actief' || versie.status === 'verzonden'),
        );
        if (isActueel) {
          aantalActieveVersiesPerBrief.set(
            versie.briefId,
            (aantalActieveVersiesPerBrief.get(versie.briefId) ?? 0) + 1,
          );
        }
        return isActueel;
      });
      for (const brief of formeleBrieven) {
        const aantal = aantalActieveVersiesPerBrief.get(brief.id) ?? 0;
        if (aantal !== 1) {
          throw new Error(`Actuele immutable versie voor ${brief.briefnummer ?? brief.id} ontbreekt of is niet uniek.`);
        }
      }

      const koppelingen = await lezen.bulkRepository
        .haalPrintbatchBrievenOpBriefversieIds(actieveVersies.map((versie) => versie.id));
      const batchIds = [...new Set(koppelingen.map((koppeling) => koppeling.batchId))].sort();
      if (batchIds.length > MAX_BATCHES_IN_SELECTIE) {
        throw new Error(`Te veel printbatches in één selectiescope (${batchIds.length}).`);
      }
      const gelezenBatches = await Promise.all(
        batchIds.map((batchId) => lezen.repository.haalPrintbatch(batchId)),
      );
      if (gelezenBatches.some((batch) => batch === null)) {
        throw new Error('Een gekoppelde printbatch kon niet formeel worden gelezen.');
      }
      const batches = gelezenBatches.filter(
        (batch): batch is NonNullable<typeof batch> => batch !== null,
      );
      const modellen = bouwProductiekernPrintbatchModellen({
        batches,
        koppelingen,
        brieven: formeleBrieven,
        versies: actieveVersies,
        signalen,
      });

      return {
        formeleBrieven,
        modellen,
        nummersPerSignaal: indexeerProductieNummersPerSignaal(modellen, formeleBrieven),
      };
    },
  });

  const nummersPerSignaal = useMemo(() => {
    const gecombineerd = new Map([...basisNummersPerSignaal].map(([id, nummers]) => [id, {
      briefnummers: [...nummers.briefnummers],
      batchnummers: [...nummers.batchnummers],
    }]));
    for (const [signaalId, nummers] of query.data?.nummersPerSignaal ?? []) {
      const bestaand = gecombineerd.get(signaalId) ?? { briefnummers: [], batchnummers: [] };
      bestaand.briefnummers = [...new Set([...bestaand.briefnummers, ...nummers.briefnummers])].sort();
      bestaand.batchnummers = [...new Set([...bestaand.batchnummers, ...nummers.batchnummers])].sort().reverse();
      gecombineerd.set(signaalId, bestaand);
    }
    return gecombineerd;
  }, [basisNummersPerSignaal, query.data?.nummersPerSignaal]);

  return {
    actief: lezen.activatie.lezenActief,
    repository: lezen.repository,
    modellen: query.data?.modellen ?? [],
    nummersPerSignaal,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
