import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { PrintbatchContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import type { ProductiekernPrintbatchModel } from '@/lib/offMarket/acquisitie/productiekernPrintbatchOverzicht';
import type { AcquisitieProductiekernRepository } from '@/lib/offMarket/acquisitie/productiekernRepository';
import { bepaalActieveProductiekernBatchdocumenten } from '@/lib/offMarket/acquisitie/productiekernBatchdocumentHerstel';
import ProductiekernBatchDocumentversieVernieuwen from './ProductiekernBatchDocumentversieVernieuwen';
import ProductiekernVastgelegdeDocumentenDownload from './ProductiekernVastgelegdeDocumentenDownload';

const OPEN_PRINTBATCHES_KEY = 'off-market-acq:open-printbatches';

function batchStatusLabel(status: PrintbatchContract['status']): string {
  switch (status) {
    case 'concept': return 'Batch samengesteld';
    case 'documenten_gegenereerd': return 'Productiebestanden gereed';
    case 'geprint': return 'Geprint · posten';
    case 'gedeeltelijk_gepost': return 'Gedeeltelijk gepost';
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

function ProductiekernPrintbatchDownloads({
  batch,
  repository,
}: {
  batch: PrintbatchContract;
  repository: AcquisitieProductiekernRepository;
}) {
  const documentenQuery = useQuery({
    queryKey: [
      'off-market-acquisitie-productiekern',
      'printbatch-documenten',
      batch.id,
      batch.documentversie,
    ],
    enabled: batch.status !== 'concept',
    staleTime: 30_000,
    queryFn: async () => {
      const alle = await repository.haalBatchdocumenten(batch.id);
      return bepaalActieveProductiekernBatchdocumenten({ batch, documenten: alle });
    },
  });

  if (batch.status === 'concept') {
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
  return <ProductiekernVastgelegdeDocumentenDownload documenten={documentenQuery.data} />;
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
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                {open
                  ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="font-mono-data text-sm font-semibold text-foreground">{model.batch.batchnummer}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {model.regels.length} {model.regels.length === 1 ? 'brief' : 'brieven'} · {model.aantalSignalen} {model.aantalSignalen === 1 ? 'signaal' : 'signalen'} · documentversie {model.batch.documentversie}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                {batchStatusLabel(model.batch.status)}
              </span>
            </button>

            {open && (
              <div
                id={inhoudId}
                className="mx-3 mb-3 overflow-hidden rounded-md border"
                data-testid={`productiekern-printbatch-${model.batch.batchnummer}`}
              >
                {repository && (
                  <div className="border-b bg-muted/15 px-3 py-3" data-testid={`productiekern-printbatch-downloads-${model.batch.batchnummer}`}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">Productiebestanden</p>
                        <p className="text-[11px] text-muted-foreground">
                          Actieve documentversie {model.batch.documentversie}
                        </p>
                      </div>
                      <ProductiekernBatchDocumentversieVernieuwen
                        batch={model.batch}
                        repository={repository}
                      />
                    </div>
                    <ProductiekernPrintbatchDownloads batch={model.batch} repository={repository} />
                  </div>
                )}
                <div className="divide-y divide-border/70">
                  {model.regels.map((regel) => (
                    <div key={regel.briefVersieId} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-3">
                      <span className="font-mono-data font-medium text-foreground">{regel.briefnummer}</span>
                      <div className="min-w-0">
                        <p className="break-words font-medium text-foreground">{regel.geadresseerde || 'Geadresseerde ontbreekt'}</p>
                        <p className="break-words text-muted-foreground">{regel.objectLabel}</p>
                      </div>
                      <Link
                        to={`/off-market/${regel.signaalId}`}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-accent hover:bg-accent/10"
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
