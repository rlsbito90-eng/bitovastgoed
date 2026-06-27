// Adresvoorstel uit opgeslagen Kadasterbericht (POC-koppeling).
//
// Roept de Edge Function `kadaster-pdf-text-extract` aan op het laatste
// opgeslagen Kadasterbericht (bij voorkeur product `rechten`) voor dit
// signaal en biedt de gebruiker handmatig een adresvoorstel aan.
//
// Strikt UI-koppeling:
//  - Geen Kadaster-aanroep, geen DB/Storage write.
//  - Vult het verzendadres alleen na expliciete klik van de gebruiker.
//  - Toont geen ruwe PDF-tekst, geen debugtekst, geen console.log van
//    namen/adressen.
import { useMemo, useState } from 'react';
import { Loader2, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  useKadasterDocumentenForSignaal, documentenPerRecord,
  type KadasterDocument,
} from '@/hooks/useKadasterDocumenten';
import { useKadasterDataRecordsForSignaal } from '@/hooks/useKadasterDataRecords';

interface RuwVoorstel {
  naam?: string;
  bedrijfsnaam?: string;
  verzendadres?: string;
  confidence?: string;
  bron?: string;
  rolLabel?: string;
  rechtType?: string;
  aandeel?: string;
}

interface BruikbaarVoorstel {
  naam: string;
  bedrijfsnaam: string;
  verzendadres: string;
  confidence: 'hoog' | 'middel';
  rolLabel: string;
  aandeel: string;
  matched: boolean;
}

interface Props {
  signaalId: string;
  huidigeNaam: string;
  huidigeBedrijfsnaam: string;
  verzendadresIsLeeg: boolean;
  bestaandVerzendadres: string;
  kandidaatBron: string | undefined;
  /** recordId van de geselecteerde kandidaat → koppelt aan kadaster_data_records.id. */
  kandidaatRecordId?: string | null;
  onPick: (adres: string, naam: string | null, bedrijfsnaam: string | null) => void;
}

type Status =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'done'; voorstellen: BruikbaarVoorstel[] }
  | { type: 'leeg' }
  | { type: 'error'; melding: string };

function kiesDocument(docs: KadasterDocument[] | undefined): KadasterDocument | null {
  if (!docs || docs.length === 0) return null;
  const rechten = docs.find(d => (d.product_codes ?? []).includes('rechten'));
  return rechten ?? docs[0];
}

function normaliseer(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Canonicaliseert een bedrijfsnaam: punten weg, rechtsvorm-tokens weg. */
function bedrijfCanonical(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((tok) => tok && !['bv', 'nv', 'bvba', 'vof', 'cv'].includes(tok))
    .join(' ')
    .trim();
}

/** Splitst persoonsnaam in voorletters + achternaam (laatste woord). */
function initialenEnAchternaam(
  naam: string,
): { initialen: string; achternaam: string } | null {
  const cleaned = naam.replace(/\./g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!cleaned) return null;
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length < 2) return null;
  const achternaam = parts[parts.length - 1];
  const voornamen = parts.slice(0, -1);
  const initialen = voornamen.map((v) => v.charAt(0)).join('');
  return { initialen, achternaam };
}

function matchVoorstel(
  v: RuwVoorstel, huidigeNaam: string, huidigeBedrijfsnaam: string,
): boolean {
  // Bedrijfsmatching: canonical (zonder rechtsvorm en punten).
  if (huidigeBedrijfsnaam && v.bedrijfsnaam) {
    const a = bedrijfCanonical(huidigeBedrijfsnaam);
    const b = bedrijfCanonical(v.bedrijfsnaam);
    if (a && b && a === b) return true;
  }
  // Persoonsmatching: initialen + achternaam.
  if (huidigeNaam && v.naam) {
    const a = initialenEnAchternaam(huidigeNaam);
    const b = initialenEnAchternaam(v.naam);
    if (a && b && a.achternaam === b.achternaam) {
      if (
        a.initialen === b.initialen
        || a.initialen.startsWith(b.initialen)
        || b.initialen.startsWith(a.initialen)
      ) return true;
    }
    // Fallback: volledige naam containment.
    const n1 = normaliseer(huidigeNaam);
    const n2 = normaliseer(v.naam);
    if (n1 && n2 && (n1 === n2 || n1.includes(n2) || n2.includes(n1))) return true;
  }
  return false;
}

/** Labelweergave voor een voorstel in de dropdown — geen adres. */
function voorstelLabel(v: BruikbaarVoorstel): string {
  const identiteit = v.bedrijfsnaam || v.naam || 'Onbekende geadresseerde';
  const stukjes: string[] = [
    identiteit,
    v.rolLabel || 'Recht onbekend',
    v.aandeel ? `aandeel ${v.aandeel}` : '',
    `conf: ${v.confidence}`,
    v.matched ? 'match' : '',
  ].filter(Boolean);
  return stukjes.join(' · ');
}

function foutmeldingVoorStatus(status: number | undefined, fallback: string): string {
  if (status === 413) return 'PDF is te groot voor automatische tekstextractie. Vul het verzendadres handmatig in.';
  if (status === 415) return 'Het opgeslagen document is geen PDF. Vul het verzendadres handmatig in.';
  if (status === 502) return 'Tekstextractie uit de PDF is mislukt. Vul het verzendadres handmatig in.';
  if (status === 404) return 'Kadasterbericht niet gevonden. Vul het verzendadres handmatig in.';
  if (status === 403 || status === 401) return 'Geen toegang tot het Kadasterbericht.';
  return fallback;
}

export default function KadasterPdfAdresVoorstelPanel({
  signaalId, huidigeNaam, huidigeBedrijfsnaam,
  verzendadresIsLeeg, bestaandVerzendadres, kandidaatBron,
  kandidaatRecordId, onPick,
}: Props) {
  const { data: docs } = useKadasterDocumentenForSignaal(signaalId);
  const { data: records } = useKadasterDataRecordsForSignaal(signaalId);
  const { doc, fallbackGebruikt } = useMemo(() => {
    if (!docs || docs.length === 0) return { doc: null as KadasterDocument | null, fallbackGebruikt: false };
    if (kandidaatRecordId) {
      const map = documentenPerRecord(docs, records ?? []);
      const gevonden = map.get(kandidaatRecordId);
      if (gevonden) return { doc: gevonden, fallbackGebruikt: false };
    }
    return { doc: kiesDocument(docs), fallbackGebruikt: true };
  }, [docs, records, kandidaatRecordId]);
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [gekozenIdx, setGekozenIdx] = useState<number | null>(null);

  // Zichtbaarheidsregels: alleen wanneer Kadaster-kandidaat is geselecteerd
  // en het verzendadres nog leeg is en er een opgeslagen PDF beschikbaar is.
  if (kandidaatBron !== 'kadaster') return null;
  if (!verzendadresIsLeeg) return null;
  if (!doc) return null;

  const start = async () => {
    setStatus({ type: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke(
        'kadaster-pdf-text-extract',
        { body: { document_id: doc.id } },
      );
      if (error) {
        const httpStatus = (error as { status?: number; context?: { status?: number } })?.status
          ?? (error as { context?: { status?: number } })?.context?.status;
        setStatus({
          type: 'error',
          melding: foutmeldingVoorStatus(httpStatus, error.message ?? 'Aanroep mislukt'),
        });
        return;
      }
      const ruw: RuwVoorstel[] = Array.isArray((data as { voorstellen?: unknown })?.voorstellen)
        ? ((data as { voorstellen: RuwVoorstel[] }).voorstellen)
        : [];
      const bruikbaar: BruikbaarVoorstel[] = ruw
        .filter(v =>
          typeof v?.verzendadres === 'string' && v.verzendadres.trim().length > 0
          && (v.confidence === 'hoog' || v.confidence === 'middel'),
        )
        .map(v => ({
          naam: (v.naam ?? '').trim(),
          bedrijfsnaam: (v.bedrijfsnaam ?? '').trim(),
          verzendadres: (v.verzendadres ?? '').trim(),
          confidence: v.confidence as 'hoog' | 'middel',
          rolLabel: (v.rolLabel ?? '').trim(),
          aandeel: (v.aandeel ?? '').trim(),
          matched: matchVoorstel(v, huidigeNaam, huidigeBedrijfsnaam),
        }));

      if (bruikbaar.length === 0) {
        setStatus({ type: 'leeg' });
        return;
      }
      // Selectiebeleid:
      //  - 1 voorstel → standaard geselecteerd (gebruiker moet nog klikken).
      //  - meerdere voorstellen + precies 1 duidelijke match → die voorgeselecteerd.
      //  - meerdere voorstellen, 0 of >1 matches → niets voorselecteren.
      const matchIdxs = bruikbaar
        .map((v, i) => (v.matched ? i : -1))
        .filter((i) => i >= 0);
      let voorkeur: number | null;
      if (bruikbaar.length === 1) voorkeur = 0;
      else if (matchIdxs.length === 1) voorkeur = matchIdxs[0];
      else voorkeur = null;
      setGekozenIdx(voorkeur);
      setStatus({ type: 'done', voorstellen: bruikbaar });
    } catch (e) {
      setStatus({
        type: 'error',
        melding: (e as Error)?.message ?? 'Aanroep mislukt',
      });
    }
  };

  const neemOver = (voorstellen: BruikbaarVoorstel[]) => {
    const v = voorstellen[gekozenIdx] ?? voorstellen[0];
    if (!v) return;
    if (bestaandVerzendadres.trim().length > 0
        && bestaandVerzendadres.trim() !== v.verzendadres) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Er staat al een verzendadres ingevuld. Wilt u dit overschrijven met het Kadasteradresvoorstel?')
        : true;
      if (!ok) return;
    }
    onPick(v.verzendadres, v.naam || null, v.bedrijfsnaam || null);
  };

  const FallbackHint = fallbackGebruikt ? (
    <p className="text-[11px] text-amber-600" data-testid="kpv-fallback-waarschuwing">
      Kon dit Kadasterdocument niet zeker aan de geselecteerde geadresseerde koppelen. Controleer het voorstel extra.
    </p>
  ) : null;

  if (status.type === 'idle') {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={start}
          data-testid="kpv-start-knop"
        >
          <Landmark className="h-4 w-4" /> Adresvoorstel uit Kadasterbericht
        </Button>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Haalt een adresvoorstel uit het opgeslagen Kadasterbericht. Controleer
          het voorstel vóór verzending.
        </p>
        {FallbackHint}
      </div>
    );
  }

  if (status.type === 'loading') {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5 text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Adresvoorstel ophalen uit Kadasterbericht…
      </div>
    );
  }

  if (status.type === 'error') {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-1.5">
        <p className="text-[11px] text-destructive" data-testid="kpv-fout">
          {status.melding}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={start}>
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  if (status.type === 'leeg') {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5">
        <p className="text-[11px] text-muted-foreground" data-testid="kpv-leeg">
          Geen adresvoorstel gevonden in het opgeslagen Kadasterbericht. Vul handmatig in.
        </p>
      </div>
    );
  }

  // done
  const voorstellen = status.voorstellen;
  return (
    <div
      className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2"
      data-testid="kpv-resultaat"
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Adresvoorstel uit Kadasterbericht
      </div>
      {voorstellen.length > 1 && (
        <Select
          value={String(gekozenIdx)}
          onValueChange={(v) => setGekozenIdx(Number(v) || 0)}
        >
          <SelectTrigger data-testid="kpv-keuze-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {voorstellen.map((v, i) => {
              const stukjes = [
                v.rolLabel || 'Recht onbekend',
                v.aandeel ? `aandeel ${v.aandeel}` : null,
                v.bedrijfsnaam ? 'bedrijfsnaam aanwezig' : v.naam ? 'naam aanwezig' : null,
                v.matched ? 'mogelijke match' : null,
                `conf: ${v.confidence}`,
              ].filter(Boolean) as string[];
              return (
                <SelectItem
                  key={i}
                  value={String(i)}
                  data-testid={`kpv-keuze-${i}`}
                >
                  {stukjes.join(' · ')}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
      {voorstellen.length === 1 && (
        <div className="text-[11px] text-muted-foreground">
          {[
            voorstellen[0].rolLabel || 'Recht onbekend',
            voorstellen[0].aandeel ? `aandeel ${voorstellen[0].aandeel}` : null,
            voorstellen[0].bedrijfsnaam
              ? 'bedrijfsnaam aanwezig'
              : voorstellen[0].naam ? 'naam aanwezig' : null,
            voorstellen[0].matched ? 'mogelijke match' : null,
            `conf: ${voorstellen[0].confidence}`,
          ].filter(Boolean).join(' · ')}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => neemOver(voorstellen)}
          data-testid="kpv-overnemen"
        >
          Neem adresvoorstel over
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStatus({ type: 'idle' })}>
          Annuleren
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Voorstel uit opgeslagen Kadaster-PDF. Controleer vóór verzending.
      </p>
      {FallbackHint}
    </div>
  );
}
