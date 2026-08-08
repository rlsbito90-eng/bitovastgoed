import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useAcquisitieReadiness, useBrievenVoorSignalen } from '@/hooks/useAcquisitieReadiness';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { productiekernStandaardUitgeschakeld } from '@/lib/offMarket/acquisitie/productieActivatiePoort';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import { meetProductiekernWorkflowPariteit } from '@/lib/offMarket/acquisitie/productiekernDossierProjectiePariteit';
import type { ProductiekernSupabaseClientSamenstelling } from '@/lib/offMarket/acquisitie/productiekernSupabaseClientSamenstelling';
import { bepaalWerkbakContext, type WerkbakContext } from '@/lib/offMarket/acquisitie/werkbak';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import ProductiekernDossierProjectie from './ProductiekernDossierProjectie';
import ProductiekernProductiepakketZone from './ProductiekernProductiepakketZone';

function ActieveProductiekernDossierProjectie({
  samenstelling,
}: {
  samenstelling: ProductiekernSupabaseClientSamenstelling;
}) {
  const { data: selectie = [], isLoading: selectieLaden } = useAcquisitieSelectie();
  const { data: signalen = [] } = useOffMarketSignalen();
  const selectieIds = useMemo(() => selectie.map((item) => item.id), [selectie]);

  const signaalIndex = useMemo(() => {
    const map = new Map<string, OffMarketSignaal>();
    for (const signaal of signalen) map.set(signaal.id, signaal);
    return map;
  }, [signalen]);

  const geselecteerdeSignalen = useMemo(
    () => selectie
      .map((item) => signaalIndex.get(item.signaal_id))
      .filter((signaal): signaal is OffMarketSignaal => Boolean(signaal)),
    [selectie, signaalIndex],
  );
  const readiness = useAcquisitieReadiness(geselecteerdeSignalen);
  const signaalIds = useMemo(
    () => geselecteerdeSignalen.map((signaal) => signaal.id),
    [geselecteerdeSignalen],
  );
  const { data: brieven = [], isLoading: brievenLaden } = useBrievenVoorSignalen(signaalIds);

  const legacyContextPerSelectieId = useMemo(() => {
    const contexten = new Map<string, WerkbakContext>();
    const selectiePerSignaal = new Map(selectie.map((item) => [item.signaal_id, item] as const));
    const brievenPerSignaal = new Map<string, typeof brieven>();

    for (const brief of brieven) {
      const lijst = brievenPerSignaal.get(brief.signaal_id) ?? [];
      lijst.push(brief);
      brievenPerSignaal.set(brief.signaal_id, lijst);
    }

    for (const { signaal, readiness: signaalReadiness } of readiness.lijst) {
      const selectieItem = selectiePerSignaal.get(signaal.id);
      if (!selectieItem) continue;
      contexten.set(selectieItem.id, bepaalWerkbakContext({
        signaal,
        readiness: signaalReadiness,
        brieven: brievenPerSignaal.get(signaal.id) ?? [],
        toegevoegdOp: selectieItem.toegevoegd_op ?? null,
      }));
    }

    return contexten;
  }, [selectie, brieven, readiness.lijst]);

  const dossierQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'dossiers', selectieIds],
    enabled: selectieIds.length > 0,
    queryFn: () => samenstelling.bulkRepository.haalDossiersOpSelectieIds(selectieIds),
    staleTime: 30_000,
  });

  const dossiers = dossierQuery.data ?? [];
  const pariteit = useMemo(
    () => meetProductiekernWorkflowPariteit({
      selectieIds,
      productiekernDossiers: dossiers,
      legacyContextPerSelectieId,
    }),
    [selectieIds, dossiers, legacyContextPerSelectieId],
  );

  return (
    <ProductiekernDossierProjectie
      dossiers={dossiers}
      totaalSelecties={selectieIds.length}
      pariteit={pariteit}
      laden={selectieLaden || brievenLaden || dossierQuery.isLoading}
    />
  );
}

/**
 * Fysieke frontendmount voor de nieuwe acquisitieproductiekern.
 *
 * De mount is aan de bestaande CRM-Supabase-client gekoppeld via de aparte
 * read-only browsercompositie. Zonder volledig leesbewijs retourneert deze
 * component vóór de actieve child wordt gemount; daardoor worden ook de
 * selectie- en productiekernreads voor deze projectie niet gestart.
 *
 * Wanneer later uitsluitend lezen expliciet wordt vrijgegeven, verschijnt een
 * observerende dossierstatusprojectie die één productiekern-bulkread gebruikt.
 * De bestaande legacy-readmodellen worden alleen gebruikt voor workflowpariteit;
 * zij blijven operationeel leidend. De productie-/writepoort blijft zelfstandig
 * dicht.
 */
export default function ProductiekernAcquisitieMount() {
  const leesSamenstelling = maakStandaardProductiekernBrowserLeesSamenstelling();

  if (!leesSamenstelling.activatie.lezenActief) return null;

  return (
    <div className="space-y-3">
      <ActieveProductiekernDossierProjectie samenstelling={leesSamenstelling} />
      <ProductiekernProductiepakketZone
        activatie={productiekernStandaardUitgeschakeld}
        pakket={null}
      />
    </div>
  );
}
