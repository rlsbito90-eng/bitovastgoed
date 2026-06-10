// KadasterOpgeslagenKaart — toont laatst opgeslagen Kadasterrecords per
// product_code voor het object. Read-only weergave; geen Kadaster-call
// vanuit deze kaart.
//
// Belangrijk:
//   - WOZ-object wordt nadrukkelijk getoond als "WOZ-objectgegevens",
//     niet als WOZ-waarde.
//   - Koopsom wordt getoond als "Kadaster-koopsom", niet als marktwaarde,
//     vraagprijs of taxatiewaarde.
//   - Rechten worden voorzichtig getoond als "Rechthebbende volgens
//     Kadaster"; geen automatische koppeling met relaties of verkoper.
import { useMemo, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useKadasterDataRecords, laatsteRecordsPerProduct, type KadasterDataRecord,
} from '@/hooks/useKadasterDataRecords';
import {
  useKadasterDocumentenForObject, documentenPerRecord,
  type KadasterDocument,
} from '@/hooks/useKadasterDocumenten';
import KadasterPdfKnop from './KadasterPdfKnop';
import KadasterRechtenBlokken from './KadasterRechtenBlokken';
import { mapRechtenBlokken, blokUitOpgeslagenRecord } from '@/lib/kadaster/rechtenBlokken';

import { KADASTER_LABELS_PER_PRODUCT } from '@/lib/kadaster/types';
import KadasterHistorieLijst from './KadasterHistorieLijst';

function fmtDatum(iso: string): string {
  try { return new Date(iso).toLocaleString('nl-NL'); } catch { return iso; }
}
function fmtNum(n: number | null): string {
  return n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('nl-NL').format(n);
}
function fmtEur(n: number | null): string {
  return n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('nl-NL', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
      }).format(n);
}
function fmtOpp(n: number | null): string {
  return n === null || n === undefined ? '—' : `${fmtNum(n)} m²`;
}
function fmtInh(n: number | null): string {
  return n === null || n === undefined ? '—' : `${fmtNum(n)} m³`;
}
function fmtZoekadres(z: Record<string, unknown>): string {
  if (!z) return '—';
  const w = typeof z.waarde === 'string' ? z.waarde : null;
  return w ?? '—';
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-data text-right">
        {value === null || value === undefined || value === '' ? '—' : value}
      </span>
    </div>
  );
}

function ObjectRecordBlok({ r }: { r: KadasterDataRecord }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
      <p className="text-sm font-medium">WOZ-objectgegevens</p>
      <p className="text-[11px] text-muted-foreground">
        WOZ- en BAG-objectkenmerken volgens Kadaster — geen WOZ-waarde.
      </p>
      <Row label="BAG-objectstatus" value={r.bag_object_status} />
      <Row label="BAG-bouwjaar" value={r.bag_bouwjaar} />
      <Row label="BAG-oppervlakte" value={fmtOpp(r.bag_oppervlakte)} />
      <Row label="Vergund gebruik" value={r.bag_gebruiksdoel} />
      <Row label="WOZ-objectnummer" value={r.woz_objectnummer} />
      <Row label="Gebruiksklasse" value={r.woz_gebruiksklasse} />
      <Row label="Feitelijk gebruik" value={r.feitelijk_gebruik} />
      <Row label="Monumentaanduiding" value={r.monumentaanduiding} />
      <Row label="WOZ-oppervlakte totaal" value={fmtOpp(r.woz_oppervlakte)} />
      <Row label="WOZ-oppervlakte wonen" value={fmtOpp(r.woz_oppervlakte_wonen)} />
      <Row label="WOZ-oppervlakte niet-wonen" value={fmtOpp(r.woz_oppervlakte_niet_wonen)} />
      <Row label="Inhoud" value={fmtInh(r.woz_inhoud)} />
      <Row label="Actualiteit" value={r.actualiteit} />
    </div>
  );
}

function WaardeRecordBlok({ r }: { r: KadasterDataRecord }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
      <p className="text-sm font-medium">Kadaster-koopsom</p>
      <p className="text-[11px] text-muted-foreground">
        Historische transactie volgens Kadaster — geen marktwaarde, vraagprijs
        of taxatiewaarde.
      </p>
      <Row label="Koopsom" value={fmtEur(r.koopsom)} />
      <Row label="Koopjaar" value={r.koopjaar} />
      <Row label="Valuta" value={r.koopsom_valuta} />
      <Row
        label="Meer onroerend goed"
        value={r.meer_onroerend_goed === null ? null : (r.meer_onroerend_goed ? 'Ja' : 'Nee')}
      />
      <Row
        label="Doelbinding"
        value={r.doelbinding === null ? null : (r.doelbinding ? 'Ja' : 'Nee')}
      />
    </div>
  );
}

function RechtenRecordBlok({ r }: { r: KadasterDataRecord }) {
  const samenvatting = r.rechten_samenvatting ?? {};
  const aantal = typeof samenvatting.aantal_rechthebbenden === 'number'
    ? samenvatting.aantal_rechthebbenden as number : null;
  const heeftVelden = !!(r.rechthebbende_naam || r.rechtsoort
    || r.aandeel || r.kadastrale_aanduiding);
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
      <p className="text-sm font-medium">Rechthebbende volgens Kadaster</p>
      <p className="text-[11px] text-muted-foreground">
        Intern opgeslagen als Kadasterrecord. Niet automatisch gekoppeld aan
        relaties, eigenaar of verkoper.
      </p>
      {!heeftVelden ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
          Rechten geleverd, maar rechthebbende-velden nog niet herkend.
          Bekijk technische details in de historie.
        </p>
      ) : (
        <>
          <Row label="Aantal rechthebbenden" value={aantal} />
          <Row label="Naam" value={r.rechthebbende_naam} />
          <Row label="Type" value={r.rechthebbende_type} />
          <Row label="Rechtsoort" value={r.rechtsoort} />
          <Row label="Aandeel" value={r.aandeel} />
          <Row label="Kadastrale aanduiding" value={r.kadastrale_aanduiding} />
        </>
      )}
    </div>
  );
}

function RecordKaart({ r }: { r: KadasterDataRecord }) {
  if (r.status !== 'geleverd' && r.status !== 'gedeeltelijk') {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {KADASTER_LABELS_PER_PRODUCT[r.product_code] ?? r.product_code}
          </p>
          <span className="text-[10px] text-muted-foreground">{r.status}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Eerder geprobeerd voor dit adres — geen gegevens geleverd door Kadaster.
        </p>
      </div>
    );
  }
  if (r.product_code === 'object') return <ObjectRecordBlok r={r} />;
  if (r.product_code === 'waarde') return <WaardeRecordBlok r={r} />;
  if (r.product_code === 'rechten') return <RechtenRecordBlok r={r} />;
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-medium">
        {KADASTER_LABELS_PER_PRODUCT[r.product_code] ?? r.product_code}
      </p>
    </div>
  );
}

interface Props { objectId: string }

export default function KadasterOpgeslagenKaart({ objectId }: Props) {
  const { data, isLoading } = useKadasterDataRecords(objectId);
  const { data: pdfs } = useKadasterDocumentenForObject(objectId);
  const records = useMemo(() => data ?? [], [data]);
  const pdfList = useMemo(() => pdfs ?? [], [pdfs]);
  const pdfPerRecord = useMemo(() => documentenPerRecord(pdfList), [pdfList]);
  const laatste = useMemo(() => laatsteRecordsPerProduct(records), [records]);
  const [techOpen, setTechOpen] = useState(false);

  const meest = records[0] ?? null;

  return (
    <div className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            Kadaster & objectdata
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Laatst opgehaalde Kadasterrecords bij dit object. Blijft beschikbaar
            ook na sluiten van de preview of refresh van de pagina.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Laden…</p>
      )}

      {!isLoading && records.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nog geen opgeslagen Kadastergegevens.
        </p>
      )}

      {!isLoading && records.length > 0 && meest && (
        <>
          <div className="rounded-md border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-0.5">
            <p>
              Laatst opgehaald: <span className="font-mono-data">{fmtDatum(meest.fetched_at)}</span>
            </p>
            <p>
              Zoekadres: <span className="font-mono-data">{fmtZoekadres(meest.zoekadres)}</span>
            </p>
            <p>
              Producten: <span className="font-mono-data">
                {Array.from(laatste.keys()).join(', ')}
              </span>
              {' · '}Bron: <span className="font-mono-data">Kadaster Objectinformatie API</span>
            </p>
          </div>

          <div className="space-y-3">
            {(['object', 'waarde', 'rechten'] as const).map((code) => {
              const r = laatste.get(code);
              if (!r) return null;
              const pdf = pdfPerRecord.get(r.id);
              return (
                <div key={code} className="space-y-1">
                  <RecordKaart r={r} />
                  {pdf && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Kadasterbericht opgeslagen
                      </span>
                      <KadasterPdfKnop document={pdf} />
                    </div>
                  )}
                  {!pdf && r.product_code === 'rechten'
                    && r.status === 'geleverd'
                    && !r.rechthebbende_naam && (
                    <p className="text-[10px] text-muted-foreground italic px-1">
                      Tip: vraag opnieuw op met "Kadasterbericht/PDF intern opslaan" aan
                      om de rechthebbende uit het officiële Kadasterbericht te kunnen lezen.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {pdfList.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> Kadasterberichten (intern, {pdfList.length})
              </p>
              <ul className="space-y-1.5">
                {pdfList.map((d: KadasterDocument) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-xs truncate">{d.bestandsnaam}</p>
                      <p className="text-[10px] text-muted-foreground font-mono-data">
                        {d.product_codes.join(', ')} · {fmtDatum(d.fetched_at)}
                      </p>
                    </div>
                    <KadasterPdfKnop document={d} />
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted-foreground italic">
                Intern opgeslagen. Niet automatisch gedeeld in dataroom of export.
              </p>
            </div>
          )}

          <KadasterHistorieLijst records={records} />

          <Collapsible open={techOpen} onOpenChange={setTechOpen}>
            <CollapsibleTrigger className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              {techOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Technische details ({records.length} record{records.length === 1 ? '' : 's'})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 overflow-auto max-h-64 rounded bg-muted/40 p-2 text-[10px] font-mono-data">
{JSON.stringify(records.map(r => ({
  id: r.id,
  product_code: r.product_code,
  status: r.status,
  fetched_at: r.fetched_at,
  zoekadres: r.zoekadres,
  raw_limited_keys: Object.keys(r.raw_limited ?? {}),
  raw_limited_rechten: (r.raw_limited as Record<string, unknown> | null | undefined)?.rechten ?? null,
})), null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
