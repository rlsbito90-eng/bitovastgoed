import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { PrintbatchContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import type { ProductiekernPrintbatchModel } from '@/lib/offMarket/acquisitie/productiekernPrintbatchOverzicht';
import type { AcquisitieProductiekernRepository } from '@/lib/offMarket/acquisitie/productiekernRepository';
import { bepaalActieveProductiekernBatchdocumenten } from '@/lib/offMarket/acquisitie/productiekernBatchdocumentHerstel';
import { laadProductiekernBatch } from '@/lib/offMarket/acquisitie/productiekernBatchLezer';
import ProductiekernBatchDocumentversieVernieuwen from './ProductiekernBatchDocumentversieVernieuwen';
import ProductiekernPrintPostBevestiging from './ProductiekernPrintPostBevestiging';
import ProductiekernVastgelegdeDocumentenDownload from './ProductiekernVastgelegdeDocumentenDownload';

const OPEN_PRINTBATCHES_KEY = 'off-market-acq:open-printbatches';

function batchStatusLabel(status: PrintbatchContract['status']): string {
  switch (status) {
    case 'concept': return 'Samengesteld';
    case 'documenten_gegenereerd': return 'Printklaar';
    case 'geprint': return 'Geprint';
    case 'gedeeltelijk_gepost': return 'Deels gepost';
    case 'gepost': return 'Gepost';
    case 'geannuleerd': return 'Geannuleerd';
  }
}

function leesOpenBatchIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(OPEN_PRINTBATCHES_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

function bewaarOpenBatchIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(OPEN_PRINTBATCHES_KEY, JSON.stringify([...ids].sort()));
  } catch {
    // Storage is alleen UX-state; bij blokkade blijft de werkbak functioneel.
  }
}

function normaliseerZoekterm(waarde: string): string {
  return waarde.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function ProductiekernPrintbatchBediening({
  batch,
  repository,
}: {
  batch: PrintbatchContract;
  repository: AcquisitieProductiekernRepository;
}) {
  const queryClient = useQueryClient();
  const [actueleBatch, setActueleBatch] = useState(batch);

  useEffect(() => {
    setActueleBatch(batch);
  }, [batch.id, batch.status, batch.documentversie, batch.printdatum, batch.verzenddatum]);

  const documentenQuery = useQuery({
    queryKey: [
      'off-market-acquisitie-productiekern',
      'printbatch-documenten',
      actueleBatch.id,
      actueleBatch.documentversie,
    ],
    enabled: actueleBatch.status !== 'concept',
    staleTime: 30_000,
    queryFn: async () => {
      const alle = await repository.haalBatchdocumenten(actueleBatch.id);
      return bepaalActieveProductiekernBatchdocumenten({ batch: actueleBatch, documenten: alle });
    },
  });

  const batchQuery = useQuery({
    queryKey: [
      'off-market-acquisitie-productiekern',
      'printbatch-bediening',
      actueleBatch.id,
      actueleBatch.status,
      actueleBatch.documentversie,
    ],
    enabled: actueleBatch.status !== 'concept' && documentenQuery.isSuccess,
    staleTime: 15_000,
    queryFn: () => laadProductiekernBatch(actueleBatch.id, repository),
  });

  const verversNaStatuswijziging = (volgende: PrintbatchContract) => {
    setActueleBatch(volgende);
    void queryClient.invalidateQueries({ queryKey: ['off-market-acquisitie-productiekern'] });
    void queryClient.invalidateQueries({ queryKey: ['off-market-brieven-bulk'] });
    void queryClient.invalidateQueries({ queryKey: ['off-market-acquisitie-selectie'] });
  };

  if (actueleBatch.status === 'concept') {
    return (
      <p className="text-[11px] text-muted-foreground">
        Deze batch is nog niet vastgelegd; er bestaan nog geen geregistreerde productiebestanden.
      </p>
    );
  }
  if (documentenQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Geregistreerde bestanden controleren…
      </p>
    );
  }
  if (documentenQuery.isError) {
    return (
      <p className="text-xs text-destructive" role="alert">
        Productiebestanden konden niet veilig worden geladen. Er is niets opnieuw gegenereerd.
      </p>
    );
  }
  if (!documentenQuery.data) return null;

  return (
    <div className="space-y-3">
      <ProductiekernVastgelegdeDocumentenDownload documenten={documentenQuery.data} />

      {batchQuery.isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Batchstatus controleren…
        </p>
      )}
      {batchQuery.isError && (
        <p className="text-xs text-destructive" role="alert">
          Batchbediening kon niet veilig worden geladen. De status is niet gewijzigd.
        </p>
      )}
      {batchQuery.data && (
        <ProductiekernPrintPostBevestiging
          batch={actueleBatch}
          brieven={batchQuery.data.brieven}
          onBatchChange={verversNaStatuswijziging}
        />
      )}
    </div>
  );
}

export default function ProductiekernPrintbatchWerkbak({
  modellen,
  fout = false,
  repository,
  zoekterm = '',
}: {
  modellen: readonly ProductiekernPrintbatchModel[];
  fout?: boolean;
  repository?: AcquisitieProductiekernRepository;
  zoekterm?: string;
}) {
  const [openBatchIds, setOpenBatchIds] = useState<Set<string>>(leesOpenBatchIds);
  const zoek = normaliseerZoekterm(zoekterm);
  const zichtbareModellen = useMemo(() => {
    if (!zoek) return modellen;
    return modellen.filter((model) => normaliseerZoekterm([
      model.batch.batchnummer,
      ...model.regels.flatMap((regel) => [
        regel.briefnummer,
        regel.geadresseerde,
        regel.objectLabel,
      ]),
    ].join(' ')).includes(zoek));
  }, [modellen, zoek]);

  const samenvatting = useMemo(() => {
    const signalen = new Set<string>();
    let brieven = 0;
    let printklaar = 0;
    let geprint = 0;
    let gepost = 0;
    for (const model of zichtbareModellen) {
      brieven += model.regels.length;
      for (const regel of model.regels) signalen.add(regel.signaalId);
      if (model.batch.status === 'documenten_gegenereerd') printklaar += model.regels.length;
      if (model.batch.status === 'geprint' || model.batch.status === 'gedeeltelijk_gepost') geprint += model.regels.length;
      if (model.batch.status === 'gepost') gepost += model.regels.length;
    }
    return { brieven, signalen: signalen.size, printklaar, geprint, gepost };
  }, [zichtbareModellen]);

  const toggleBatch = (batchId: string) => {
    setOpenBatchIds((huidig) => {
      const volgende = new Set(huidig);
      if (volgende.has(batchId)) volgende.delete(batchId);
      else volgende.add(batchId);
      bewaarOpenBatchIds(volgende);
      return volgende;
    });
  };

  if (fout) {
    return (
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" data-testid="productiekern-printbatches-fout">
        Printbatches konden niet volledig worden geladen. Er is niets gewijzigd.
      </section>
    );
  }

  if (zichtbareModellen.length === 0) {
    return (
      <section className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground" data-testid="productiekern-printbatches-leeg">
        {zoek
          ? `Geen printbatch gevonden voor “${zoekterm.trim()}”.`
          : 'Nog geen formele printbatch gekoppeld aan brieven in deze acquisitieselectie.'}
      </section>
    );
  }

  return (
    <section className="space-y-2" data-testid="productiekern-printbatches-werkbak" aria-label="Formele printbatches">
      <div className="rounded-lg border bg-card px-3 py-2.5 text-xs text-muted-foreground" data-testid="productiekern-printbatches-samenvatting">
        <p className="font-medium text-foreground">
          {samenvatting.brieven} {samenvatting.brieven === 1 ? 'brief' : 'brieven'} in BAT · {samenvatting.signalen} {samenvatting.signalen === 1 ? 'signaal' : 'signalen'}
        </p>
        <p className="mt-0.5">
          Printklaar {samenvatting.printklaar} · Geprint / te posten {samenvatting.geprint} · Gepost {samenvatting.gepost}
        </p>
      </div>

      {zichtbareModellen.map((model) => {
        const open = openBatchIds.has(model.batch.id);
        const inhoudId = `productiekern-printbatch-inhoud-${model.batch.id}`;
        return (
          <article key={model.batch.id} className="overflow-hidden rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => toggleBatch(model.batch.id)}
              aria-expanded={open}
              aria-controls={inhoudId}
              data-testid={`productiekern-printbatch-toggle-${model.batch.batchnummer}`}
              className="w-full min-w-0 px-3 py-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                {open
                  ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <p className="break-all font-mono-data text-sm font-semibold text-foreground">
                      {model.batch.batchnummer}
                    </p>
                    <span
                      className="self-start rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground sm:shrink-0 sm:text-xs"
                      data-testid={`productiekern-printbatch-status-${model.batch.batchnummer}`}
                    >
                      {batchStatusLabel(model.batch.status)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
                    <span>{model.regels.length} {model.regels.length === 1 ? 'brief' : 'brieven'}</span>
                    <span>{model.aantalSignalen} {model.aantalSignalen === 1 ? 'signaal' : 'signalen'}</span>
                    <span>versie {model.batch.documentversie}</span>
                  </div>
                </div>
              </div>
            </button>

            {open && (
              <div
                id={inhoudId}
                className="overflow-hidden border-t sm:mx-3 sm:mb-3 sm:rounded-md sm:border"
                data-testid={`productiekern-printbatch-${model.batch.batchnummer}`}
              >
                {repository && (
                  <div className="border-b bg-muted/15 px-3 py-3 sm:px-4" data-testid={`productiekern-printbatch-downloads-${model.batch.batchnummer}`}>
                    <div className="mb-2">
                      <p className="text-xs font-medium text-foreground">Productiebestanden & status</p>
                      <p className="text-[11px] text-muted-foreground">
                        Actieve documentversie {model.batch.documentversie}
                      </p>
                    </div>
                    <ProductiekernPrintbatchBediening batch={model.batch} repository={repository} />
                    <ProductiekernBatchDocumentversieVernieuwen
                      batch={model.batch}
                      repository={repository}
                    />
                  </div>
                )}
                <div className="divide-y divide-border/70">
                  {model.regels.map((regel) => (
                    <div
                      key={regel.briefVersieId}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-2.5 text-xs sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center sm:py-2"
                    >
                      <span className="col-start-1 row-start-1 font-mono-data font-medium text-foreground">
                        {regel.briefnummer}
                      </span>
                      <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                        <p className="break-words font-medium text-foreground">{regel.geadresseerde || 'Geadresseerde ontbreekt'}</p>
                        <p className="break-words text-muted-foreground">{regel.objectLabel}</p>
                      </div>
                      <Link
                        to={`/off-market/${regel.signaalId}`}
                        className="col-start-2 row-start-1 inline-flex min-h-7 items-center gap-1.5 justify-self-end whitespace-nowrap rounded-md px-1 text-xs font-medium text-accent hover:bg-accent/10 sm:col-start-3 sm:px-2"
                        aria-label={`Open signaal voor ${regel.briefnummer}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open signaal
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
