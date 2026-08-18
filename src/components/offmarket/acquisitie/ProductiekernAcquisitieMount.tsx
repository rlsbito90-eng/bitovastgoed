import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useAcquisitieReadiness, useBrievenVoorSignalen } from '@/hooks/useAcquisitieReadiness';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
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
import ProductiekernPrintbatchWerkbak, {
  bouwProductiekernPrintbatchModellen,
} from './ProductiekernPrintbatchWerkbak';
import ProductiekernProductiepakketZone from './ProductiekernProductiepakketZone';
import type { ProductiekernWerkbakView } from './ProductiekernWerkbakChips';

const PRODUCTIEKERN_WERKBAK_KEY = 'off-market-acq:productiekern-werkbak';
const PRODUCTIE_INGANG_TESTID = 'acquisitie-bulk-gecombineerde-pdf';
const LEGACY_PRODUCTIE_ACTIE_TESTIDS = [
  'acquisitie-bulk-adreslabels',
  'acquisitie-bulk-markeer-geprint',
  'acquisitie-bulk-markeer-gepost',
] as const;
const MAX_BATCHES_IN_SELECTIE = 20;

function leesInitieleProductiekernWerkbak(): ProductiekernWerkbakView {
  try {
    const waarde = sessionStorage.getItem(PRODUCTIEKERN_WERKBAK_KEY);
    if (
      waarde === 'nieuwe_selectie'
      || waarde === 'eigenaar_achterhalen'
      || waarde === 'brief_opstellen'
      || waarde === 'printklaar'
      || waarde === 'printbatches'
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
    knop.style.setProperty('display', 'none', 'important');
    knop.setAttribute('aria-hidden', 'true');
    knop.tabIndex = -1;
  }
}

function useConsolideerProductiekernToolbar(actief: boolean) {
  useEffect(() => {
    if (!actief) return;

    pasProductiekernToolbarSemantiekToe();
    if (typeof MutationObserver === 'undefined' || !document.body) return;

    const observer = new MutationObserver(() => pasProductiekernToolbarSemantiekToe());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
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

  // Formele brieven leven bewust in dezelfde tabel als de legacy concepten.
  // De Productiekern-identiteit wordt hier fail-closed herkend aan definitief +
  // een formele selectie_id; daarna gaan alle reads via het Productiekern-contract.
  const formeleBriefIds = useMemo(() => brieven
    .filter((brief) => {
      const formeel = brief as typeof brief & { status?: string; selectie_id?: string | null };
      return formeel.status === 'definitief'
        && typeof formeel.selectie_id === 'string'
        && formeel.selectie_id.trim().length > 0;
    })
    .map((brief) => brief.id)
    .sort(), [brieven]);

  const formeleBrievenQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'batch-brieven', formeleBriefIds],
    enabled: formeleBriefIds.length > 0,
    queryFn: () => samenstelling.bulkRepository.haalBrievenOpIds(formeleBriefIds),
    staleTime: 30_000,
  });

  const formeleVersiesQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'batch-briefversies', formeleBriefIds],
    enabled: formeleBriefIds.length > 0,
    queryFn: () => samenstelling.bulkRepository.haalBriefversiesOpBriefIds(formeleBriefIds),
    staleTime: 30_000,
  });
  const actieveFormeleVersies = useMemo(() => {
    const actiefPerBrief = new Map<string, number>();
    const actief = (formeleVersiesQuery.data ?? []).filter((versie) => versie.status === 'actief');
    for (const versie of actief) {
      actiefPerBrief.set(versie.briefId, (actiefPerBrief.get(versie.briefId) ?? 0) + 1);
    }
    if ([...actiefPerBrief.values()].some((aantal) => aantal > 1)) {
      return [];
    }
    return actief;
  }, [formeleVersiesQuery.data]);
  const actieveFormeleVersieIds = useMemo(
    () => actieveFormeleVersies.map((versie) => versie.id).sort(),
    [actieveFormeleVersies],
  );

  const batchKoppelingenQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'batch-koppelingen', actieveFormeleVersieIds],
    enabled: actieveFormeleVersieIds.length > 0,
    queryFn: () => samenstelling.bulkRepository.haalPrintbatchBrievenOpBriefversieIds(actieveFormeleVersieIds),
    staleTime: 30_000,
  });
  const batchIds = useMemo(() => [...new Set(
    (batchKoppelingenQuery.data ?? []).map((koppeling) => koppeling.batchId),
  )].sort(), [batchKoppelingenQuery.data]);

  const batchesQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'printbatches', batchIds],
    enabled: batchIds.length > 0,
    queryFn: async () => {
      if (batchIds.length > MAX_BATCHES_IN_SELECTIE) {
        throw new Error(`Te veel printbatches in één selectiescope (${batchIds.length}).`);
      }
      const batches = await Promise.all(batchIds.map((id) => samenstelling.repository.haalPrintbatch(id)));
      if (batches.some((batch) => batch === null)) {
        throw new Error('Een gekoppelde printbatch kon niet formeel worden gelezen.');
      }
      return batches.filter((batch): batch is NonNullable<typeof batch> => batch !== null);
    },
    staleTime: 30_000,
  });

  const batchModellen = useMemo(() => bouwProductiekernPrintbatchModellen({
    batches: batchesQuery.data ?? [],
    koppelingen: batchKoppelingenQuery.data ?? [],
    brieven: formeleBrievenQuery.data ?? [],
    versies: actieveFormeleVersies,
    signalen: geselecteerdeSignalen,
  }), [
    batchesQuery.data,
    batchKoppelingenQuery.data,
    formeleBrievenQuery.data,
    actieveFormeleVersies,
    geselecteerdeSignalen,
  ]);
  const batchFout = formeleBrievenQuery.isError
    || formeleVersiesQuery.isError
    || batchKoppelingenQuery.isError
    || batchesQuery.isError;
  const batchLaden = formeleBrievenQuery.isLoading
    || formeleVersiesQuery.isLoading
    || batchKoppelingenQuery.isLoading
    || batchesQuery.isLoading;

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

  const laden = selectieLaden || signalenLaden || brievenLaden || dossierQuery.isLoading || batchLaden;
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
        printbatchAantal={batchFout ? 0 : batchModellen.length}
        pariteit={pariteit}
        laden={laden}
        fout={dossierQuery.isError}
      />
      {actieveWerkbak === 'printbatches' && !laden && (
        <ProductiekernPrintbatchWerkbak modellen={batchModellen} fout={batchFout} />
      )}
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
