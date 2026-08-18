import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

import type {
  BriefContract,
  BriefversieContract,
  PrintbatchBriefContract,
  PrintbatchContract,
} from '@/lib/offMarket/acquisitie/productiekernContract';
import { productiekernGeadresseerdeNaam } from '@/lib/offMarket/acquisitie/productiekernGeadresseerdeNaam';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export interface ProductiekernPrintbatchRegel {
  briefId: string;
  briefVersieId: string;
  briefnummer: string;
  signaalId: string;
  geadresseerde: string;
  objectLabel: string;
}

export interface ProductiekernPrintbatchModel {
  batch: PrintbatchContract;
  regels: ProductiekernPrintbatchRegel[];
  aantalSignalen: number;
}

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

export function bouwProductiekernPrintbatchModellen(input: {
  batches: readonly PrintbatchContract[];
  koppelingen: readonly PrintbatchBriefContract[];
  brieven: readonly BriefContract[];
  versies: readonly BriefversieContract[];
  signalen: readonly OffMarketSignaal[];
}): ProductiekernPrintbatchModel[] {
  const briefIndex = new Map(input.brieven.map((brief) => [brief.id, brief] as const));
  const versieIndex = new Map(input.versies.map((versie) => [versie.id, versie] as const));
  const signaalIndex = new Map(input.signalen.map((signaal) => [signaal.id, signaal] as const));

  return [...input.batches]
    .sort((a, b) => b.batchnummer.localeCompare(a.batchnummer))
    .map((batch) => {
      const regels = input.koppelingen
        .filter((koppeling) => koppeling.batchId === batch.id && koppeling.verwijderdOp === null)
        .map((koppeling): ProductiekernPrintbatchRegel | null => {
          const brief = briefIndex.get(koppeling.briefId);
          const versie = versieIndex.get(koppeling.briefVersieId);
          if (!brief || !versie || !brief.briefnummer) return null;
          const signaal = signaalIndex.get(brief.signaalId);
          const adres = signaal?.adres?.trim() ?? versie.inhoud.objectadres?.trim() ?? '';
          const plaats = signaal?.plaats?.trim() ?? '';
          return {
            briefId: brief.id,
            briefVersieId: versie.id,
            briefnummer: brief.briefnummer,
            signaalId: brief.signaalId,
            geadresseerde: productiekernGeadresseerdeNaam(versie.geadresseerde),
            objectLabel: [adres, plaats].filter(Boolean).join(' · ') || 'Object niet benoemd',
          };
        })
        .filter((regel): regel is ProductiekernPrintbatchRegel => regel !== null)
        .sort((a, b) => a.briefnummer.localeCompare(b.briefnummer));

      return {
        batch,
        regels,
        aantalSignalen: new Set(regels.map((regel) => regel.signaalId)).size,
      };
    })
    .filter((model) => model.regels.length > 0);
}

export default function ProductiekernPrintbatchWerkbak({
  modellen,
  fout = false,
}: {
  modellen: readonly ProductiekernPrintbatchModel[];
  fout?: boolean;
}) {
  if (fout) {
    return (
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" data-testid="productiekern-printbatches-fout">
        Printbatches konden niet volledig worden geladen. Er is niets gewijzigd.
      </section>
    );
  }

  if (modellen.length === 0) {
    return (
      <section className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground" data-testid="productiekern-printbatches-leeg">
        Nog geen formele printbatch gekoppeld aan brieven in deze acquisitieselectie.
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid="productiekern-printbatches-werkbak" aria-label="Formele printbatches">
      {modellen.map((model) => (
        <article key={model.batch.id} className="rounded-lg border bg-card px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono-data text-sm font-semibold text-foreground">{model.batch.batchnummer}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {model.regels.length} {model.regels.length === 1 ? 'brief' : 'brieven'} · {model.aantalSignalen} {model.aantalSignalen === 1 ? 'signaal' : 'signalen'} · documentversie {model.batch.documentversie}
              </p>
            </div>
            <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
              {batchStatusLabel(model.batch.status)}
            </span>
          </div>

          <div className="mt-3 divide-y divide-border/70 rounded-md border" data-testid={`productiekern-printbatch-${model.batch.batchnummer}`}>
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
        </article>
      ))}
    </section>
  );
}
