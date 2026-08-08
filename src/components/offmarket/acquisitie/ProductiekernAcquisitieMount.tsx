import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { productiekernStandaardUitgeschakeld } from '@/lib/offMarket/acquisitie/productieActivatiePoort';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import type { ProductiekernSupabaseClientSamenstelling } from '@/lib/offMarket/acquisitie/productiekernSupabaseClientSamenstelling';
import ProductiekernDossierProjectie from './ProductiekernDossierProjectie';
import ProductiekernProductiepakketZone from './ProductiekernProductiepakketZone';

function ActieveProductiekernDossierProjectie({
  samenstelling,
}: {
  samenstelling: ProductiekernSupabaseClientSamenstelling;
}) {
  const { data: selectie = [], isLoading: selectieLaden } = useAcquisitieSelectie();
  const selectieIds = useMemo(() => selectie.map((item) => item.id), [selectie]);

  const dossierQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'dossiers', selectieIds],
    enabled: selectieIds.length > 0,
    queryFn: () => samenstelling.bulkRepository.haalDossiersOpSelectieIds(selectieIds),
    staleTime: 30_000,
  });

  return (
    <ProductiekernDossierProjectie
      dossiers={dossierQuery.data ?? []}
      totaalSelecties={selectieIds.length}
      laden={selectieLaden || dossierQuery.isLoading}
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
 * observerende dossierstatusprojectie die één bulkread gebruikt. Zij verandert
 * geen legacywerkbak, filter, sortering of writepad. De productie-/writepoort
 * blijft zelfstandig dicht.
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
