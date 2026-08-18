import { useEffect, useMemo, useState } from 'react';
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
const PRODUCTIE_INGANG_TESTID = 'acquisitie-bulk-gecombineerde-pdf';
const LEGACY_PRODUCTIE_ACTIE_TESTIDS = [
  'acquisitie-bulk-adreslabels',
  'acquisitie-bulk-markeer-geprint',
  'acquisitie-bulk-markeer-gepost',
] as const;

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

function pasProductiekernToolbarSemantiekToe() {
  const ingang = document.querySelector<HTMLButtonElement>(
    `[data-testid="${PRODUCTIE_INGANG_TESTID}"]`,
  );
  if (ingang) {
    ingang.setAttribute('aria-label', 'Conceptbrieven & productie');
    ingang.setAttribute(
      'title',
      'Conceptbrieven controleren, definitief maken en daarna formele BAT-productie uitvoeren.',
    );
    for (const node of Array.from(ingang.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      if (!node.textContent?.includes('Brieven-PDF')) continue;
      node.textContent = ' Conceptbrieven & productie';
    }
  }

  for (const testId of LEGACY_PRODUCTIE_ACTIE_TESTIDS) {
    const knop = document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    if (!knop) continue;
    knop.hidden = true;
    knop.setAttribute('aria-hidden', 'true');
    knop.tabIndex = -1;
  }
}

/**
 * Zodra de formele Productiekern actief is, is er nog maar één primaire
 * productieroute vanuit de Acquisitieselectie. De oude losse label/print/post-
 * snelwegen blijven tijdelijk in legacycode aanwezig voor rollback, maar worden
 * in de actieve Productiekern-UI bewust niet aangeboden.
 */
function useConsolideerProductiekernToolbar(actief: boolean) {
  useEffect(() => {
    if (!actief) return;

    pasProductiekernToolbarSemantiekToe();
    const toolbar = document.querySelector('[data-testid="acquisitie-bulk-toolbar"]');
    if (!toolbar || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => pasProductiekernToolbarSemantiekToe());
    observer.observe(toolbar, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [actief]);
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

export default function ProductiekernAcquisitieMount() {
  const leesSamenstelling = maakStandaardProductiekernBrowserLeesSamenstelling();
  useConsolideerProductiekernToolbar(leesSamenstelling.activatie.lezenActief);

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
