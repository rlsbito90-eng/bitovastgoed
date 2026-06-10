// Presentational: Kadaster Rechten als blokken met optionele PDF-bron.
// Bewust geen automatische CRM-koppeling, geen eigenaar/verkoper-invulling.
import { FileText } from 'lucide-react';
import type { KadasterRechtenBlok } from '@/lib/kadaster/rechtenBlokken';
import KadasterPdfKnop from './KadasterPdfKnop';
import type { KadasterDocument } from '@/hooks/useKadasterDocumenten';

interface Props {
  blokken: KadasterRechtenBlok[];
  pdf?: KadasterDocument | null;
  intro?: string;
  /** Toont titel "Rechthebbenden volgens Kadaster" bovenaan. Standaard aan. */
  toonTitel?: boolean;
}

function Veld({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-mono-data text-right break-words">{value}</span>
    </div>
  );
}

function PdfBronBalk({ pdf }: { pdf: KadasterDocument }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-[11px] text-foreground inline-flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-primary" />
        Kadasterbericht opgeslagen — officiële bron
      </span>
      <KadasterPdfKnop document={pdf} label="Kadasterbericht openen" />
    </div>
  );
}

function BlokKaart({ blok }: { blok: KadasterRechtenBlok }) {
  const partijLabel = blok.bedrijfsnaam ?? blok.naam ?? '—';
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{blok.rechtstype ?? 'Recht (type onbekend)'}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            Rechthebbende volgens Kadaster
          </p>
        </div>
        {blok.aandeel && (
          <span className="text-[11px] font-mono-data rounded border border-border bg-muted/40 px-1.5 py-0.5">
            Aandeel {blok.aandeel}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">{partijLabel}</p>
        <Veld label="Geboren" value={[blok.geboortedatum, blok.geboorteplaats ? `te ${blok.geboorteplaats}` : null]
          .filter(Boolean).join(' ') || null} />
        <Veld label="KvK-nummer" value={blok.kvkNummer} />
        <Veld label="Zetel" value={blok.zetel} />
      </div>

      {(blok.adresRegels.length > 0 || blok.postcode || blok.plaats) && (
        <div className="text-xs">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Adres</p>
          {blok.adresRegels.map((r, i) => <p key={i} className="font-mono-data">{r}</p>)}
          {(blok.postcode || blok.plaats) && (
            <p className="font-mono-data">
              {[blok.postcode, blok.plaats].filter(Boolean).join(' ')}
            </p>
          )}
        </div>
      )}

      <Veld label="Kadastrale aanduiding" value={blok.kadastraleAanduiding} />
      {blok.registerVerwijzing && (
        <p className="text-[11px] text-muted-foreground italic pt-1 border-t border-border/50">
          {blok.registerVerwijzing}
        </p>
      )}
    </div>
  );
}

export default function KadasterRechtenBlokken({
  blokken, pdf, intro, toonTitel = true,
}: Props) {
  const heeftBlokken = blokken.length > 0;
  return (
    <div className="space-y-2">
      {toonTitel && (
        <p className="text-sm font-medium">Rechthebbenden volgens Kadaster</p>
      )}
      {intro && <p className="text-[11px] text-muted-foreground">{intro}</p>}

      {pdf && <PdfBronBalk pdf={pdf} />}

      {!heeftBlokken && pdf && (
        <p className="text-[11px] text-muted-foreground rounded border border-border/60 bg-muted/20 p-2">
          Rechten geleverd. Open het Kadasterbericht hierboven voor de
          volledige eigenaar-/rechthebbendeinformatie.
        </p>
      )}

      {!heeftBlokken && !pdf && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          Rechten geleverd, maar beperkte velden herkend. Vraag opnieuw op met
          "Kadasterbericht/PDF intern opslaan" voor de officiële, volledige
          rechthebbendeinformatie.
        </p>
      )}

      {heeftBlokken && (
        <div className="space-y-2">
          {blokken.map((b) => <BlokKaart key={b.id} blok={b} />)}
          {pdf && (
            <p className="text-[10px] text-muted-foreground italic">
              De bovenstaande gegevens zijn een samenvatting. Het Kadasterbericht
              blijft de officiële bron. Niets wordt automatisch gekoppeld aan
              relaties, eigenaar of verkoper.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
