import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useAcquisitieReadiness, useBrievenVoorSignalen } from '@/hooks/useAcquisitieReadiness';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { productiekernStandaardUitgeschakeld } from '@/lib/offMarket/acquisitie/productieActivatiePoort';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import {
  maakStandaardProductiekernBrowserWriteSamenstelling,
  type ProductiekernBrowserWriteSamenstelling,
} from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import { meetProductiekernWorkflowPariteit } from '@/lib/offMarket/acquisitie/productiekernDossierProjectiePariteit';
import type { ProductiekernSupabaseClientSamenstelling } from '@/lib/offMarket/acquisitie/productiekernSupabaseClientSamenstelling';
import { bepaalWerkbakContext, type WerkbakContext } from '@/lib/offMarket/acquisitie/werkbak';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import ProductiekernDossierProjectie from './ProductiekernDossierProjectie';
import ProductiekernNogNietGestart from './ProductiekernNogNietGestart';
import ProductiekernProductiepakketZone from './ProductiekernProductiepakketZone';
import type { ProductiekernWerkbakView } from './ProductiekernWerkbakChips';

const PRODUCTIEKERN_WERKBAK_KEY = 'off-market-acq:productiekern-werkbak';

function leesInitieleProductiekernWerkbak(): ProductiekernWerkbakView {
  try {
    const waarde = sessionStorage.getItem(PRODUCTIEKERN_WERKBAK_KEY);
    if (
      waarde === 'nieuwe_selectie'
      || waarde === 'eigenaar_achterhalen'
      || waarde === 'brief_opstellen'
      || waarde === 'printklaar'
      || waarde === 'geprint_posten'
      || waarde === 'opvolgen'
      || waarde === 'wachten'
      || waarde === 'afgehandeld'
      || waarde === 'alles'
    ) return waarde;
  } catch {
    // Geen browserstorage beschikbaar: veilige standaard hieronder.
  }
  return 'nieuwe_selectie';
}

function ActieveProductiekernDossierProjectie({
  samenstelling,
  writeSamenstelling,
}: {
  samenstelling: ProductiekernSupabaseClientSamenstelling;
  writeSamenstelling: ProductiekernBrowserWriteSamenstelling;
}) {
  const { data: selectie = [], isLoading: selectieLaden } = useAcquisitieSelectie();
  const { data: signalen = [], isLoading: signalenLaden } = useOffMarketSignalen();
  const selectieIds = useMemo(() => selectie.map((item) => item.id), [selectie]);
  const [actieveWerkbak, setActieveWerkbakState] = useState<ProductiekernWerkbakView>(
    leesInitieleProductiekernWerkbak,
  );

  const setActieveWerkbak = (werkbak: ProductiekernWerkbakView) => {
    setActieveWerkbakState(werkbak);
    try { sessionStorage.setItem(PRODUCTIEKERN_WERKBAK_KEY, werkbak); } catch { /* ignore */ }
  };

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
  const dossierSelectieIds = useMemo(
    () => new Set(dossiers.map((dossier) => dossier.selectieId)),
    [dossiers],
  );
  const nogNietGestart = useMemo(
    () => selectie
      .filter((item) => !dossierSelectieIds.has(item.id))
      .map((item) => {
        const signaal = signaalIndex.get(item.signaal_id);
        const adres = signaal?.adres?.trim() ?? '';
        const plaats = signaal?.plaats?.trim() ?? '';
        const label = [adres, plaats].filter(Boolean).join(', ') || `Selectie ${item.id}`;
        return {
          selectieId: item.id,
          signaalId: item.signaal_id,
          label,
        };
      }),
    [selectie, dossierSelectieIds, signaalIndex],
  );
  const pariteit = useMemo(
    () => dossierQuery.isError
      ? null
      : meetProductiekernWorkflowPariteit({
        selectieIds,
        productiekernDossiers: dossiers,
        legacyContextPerSelectieId,
      }),
    [selectieIds, dossiers, legacyContextPerSelectieId, dossierQuery.isError],
  );

  // Eén uniforme laadgrens voor de volledige projectie. Met name de signalenread
  // moet klaar zijn vóór `Nog niet gestart` labels worden opgebouwd; anders kan
  // een refresh tijdelijk ruwe selectie-UUID's als gebruikerslabel tonen.
  const laden = selectieLaden || signalenLaden || brievenLaden || dossierQuery.isLoading;
  const toonNogNietGestart = !laden
    && !dossierQuery.isError
    && (actieveWerkbak === 'nieuwe_selectie' || actieveWerkbak === 'alles');

  return (
    <div className="space-y-3">
      <ProductiekernDossierProjectie
        dossiers={dossiers}
        totaalSelecties={selectieIds.length}
        actieveWerkbak={actieveWerkbak}
        onWerkbakChange={setActieveWerkbak}
        pariteit={pariteit}
        laden={laden}
        fout={dossierQuery.isError}
      />
      {toonNogNietGestart && (
        <ProductiekernNogNietGestart
          items={nogNietGestart}
          writeSamenstelling={writeSamenstelling}
        />
      )}
    </div>
  );
}

/**
 * Fysieke frontendmount voor de nieuwe acquisitieproductiekern.
 *
 * De mount is aan de bestaande CRM-Supabase-client gekoppeld via de aparte
 * browsercompositie. Zonder volledig leesbewijs retourneert deze component vóór
 * de actieve child wordt gemount; daardoor worden ook selectie- en
 * productiekernreads voor deze projectie niet gestart.
 *
 * In een expliciet vrijgegeven werk-CRM toont de mount de formele acht
 * operationele werkbakken op basis van de Productiekern-dossiers. Selecties
 * zonder dossier worden apart als `Nog niet gestart` getoond en kunnen via de
 * fail-closed werk-CRM-writecompositie expliciet worden gestart. Legacydata
 * wordt alleen voor pariteitsobservatie gebruikt.
 */
export default function ProductiekernAcquisitieMount() {
  const leesSamenstelling = maakStandaardProductiekernBrowserLeesSamenstelling();

  if (!leesSamenstelling.activatie.lezenActief) return null;

  const writeSamenstelling = maakStandaardProductiekernBrowserWriteSamenstelling();

  return (
    <div className="space-y-3">
      <ActieveProductiekernDossierProjectie
        samenstelling={leesSamenstelling}
        writeSamenstelling={writeSamenstelling}
      />
      <ProductiekernProductiepakketZone
        activatie={writeSamenstelling.activatie}
        pakket={null}
      />
    </div>
  );
}
