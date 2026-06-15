// BriefVoorbereidenDialog — V1.1 Off-Market signaal.
//
// Wijzigingen t.o.v. V1:
//  - apart editable veld "Objectomschrijving in brief" (mag breder zijn
//    dan het feitelijke objectadres);
//  - Kadaster-verzendadres prefill via extraheerEigenaarKandidaten;
//  - placeholdertekst voor verzendadres wordt nooit als echte waarde
//    opgeslagen/gekopieerd/geprint;
//  - print/PDF via verborgen iframe in dezelfde tab — geen window.open()
//    en dus geen pop-up blocker afhankelijkheid;
//  - bevestiging bij "Markeer als verstuurd" als verzendadres leeg is.
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Printer, Send, FileText } from 'lucide-react';
import bitoLogo from '@/assets/bito-logo.png';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  bouwBriefPrefill, bouwGeadresseerdeBlok, bepaalAanhef, bouwBriefTekst,
  formatDatumNL, BITO_CONTACT, VERZENDADRES_PLACEHOLDER,
} from '@/lib/offMarket/brief';
import { useUpsertBrief, useMarkBriefVerstuurd } from '@/hooks/useOffMarketBrieven';
import { useDataStore } from '@/hooks/useDataStore';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { deadlineOverDagen } from '@/lib/offMarket/eigenaar';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signaal: OffMarketSignaal;
  kadasterRecords: KadasterDataRecord[];
}

/** Placeholdertekst mag nooit als echte waarde tellen. */
function isEchteWaarde(v: string | null | undefined): boolean {
  if (!v) return false;
  const norm = v.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!norm) return false;
  const ph = VERZENDADRES_PLACEHOLDER.replace(/\s+/g, ' ').trim().toLowerCase();
  return norm !== ph;
}

export default function BriefVoorbereidenDialog({
  open, onOpenChange, signaal, kadasterRecords,
}: Props) {
  const prefill = useMemo(
    () => bouwBriefPrefill(signaal, kadasterRecords),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signaal.id, kadasterRecords.length, open],
  );

  const [kandidaatLabel, setKandidaatLabel] = useState<string>(prefill.kandidaten[0]?.label ?? '');
  const [eigenaarNaam, setEigenaarNaam] = useState(prefill.eigenaarNaam);
  const [eigenaarBedrijfsnaam, setEigenaarBedrijfsnaam] = useState(prefill.eigenaarBedrijfsnaam);
  const [verzendadres, setVerzendadres] = useState(prefill.verzendadres);
  const [objectadres, setObjectadres] = useState(prefill.objectadres);
  const [objectomschrijving, setObjectomschrijving] = useState(prefill.objectomschrijving);
  const [aanhef, setAanhef] = useState(prefill.aanhef);
  const [onderwerp, setOnderwerp] = useState(prefill.onderwerp);
  const [brieftekst, setBrieftekst] = useState(prefill.brieftekst);
  const [briefId, setBriefId] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKandidaatLabel(prefill.kandidaten[0]?.label ?? '');
    setEigenaarNaam(prefill.eigenaarNaam);
    setEigenaarBedrijfsnaam(prefill.eigenaarBedrijfsnaam);
    setVerzendadres(prefill.verzendadres);
    setObjectadres(prefill.objectadres);
    setObjectomschrijving(prefill.objectomschrijving);
    setAanhef(prefill.aanhef);
    setOnderwerp(prefill.onderwerp);
    setBrieftekst(prefill.brieftekst);
    setBriefId(null);
  }, [open, prefill]);

  const upsert = useUpsertBrief();
  const markVerstuurd = useMarkBriefVerstuurd();
  const { addTaak } = useDataStore();

  const handleKandidaatWissel = (label: string) => {
    setKandidaatLabel(label);
    const k = prefill.kandidaten.find(x => x.label === label);
    if (k) {
      setEigenaarNaam(k.naam ?? '');
      setEigenaarBedrijfsnaam(k.bedrijfsnaam ?? '');
      if (k.verzendadres) setVerzendadres(k.verzendadres);
      const nieuweAanhef = bepaalAanhef(k.naam);
      setAanhef(nieuweAanhef);
      setBrieftekst(bouwBriefTekst({ aanhef: nieuweAanhef, objectadres: objectomschrijving }));
    }
  };

  const herstelStandaard = () => {
    setBrieftekst(bouwBriefTekst({ aanhef, objectadres: objectomschrijving }));
    toast.success('Standaardtekst hersteld');
  };

  /** Verzendadres veilig opslaan: placeholdertekst → null. */
  const verzendadresVoorOpslag = (): string | null =>
    isEchteWaarde(verzendadres) ? verzendadres.trim() : null;

  const ensureBriefOpgeslagen = async (status: 'concept' | 'verstuurd' = 'concept'): Promise<string | null> => {
    try {
      const res = await upsert.mutateAsync({
        id: briefId ?? undefined,
        signaal_id: signaal.id,
        eigenaar_naam: eigenaarNaam || null,
        eigenaar_bedrijfsnaam: eigenaarBedrijfsnaam || null,
        verzendadres: verzendadresVoorOpslag(),
        objectadres: objectadres || null,
        objectomschrijving: objectomschrijving || null,
        aanhef,
        onderwerp,
        brieftekst,
        status,
      });
      setBriefId(res.id);
      return res.id;
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan brief mislukt');
      return null;
    }
  };

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(brieftekst);
      toast.success('Brief gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  /**
   * Browserproof print: render brief in een verborgen iframe binnen
   * dezelfde tab en roep `iframe.contentWindow.print()` aan. Geen
   * `window.open()` dus geen pop-up blocker. Werkt op Chrome/Safari/iOS.
   */
  const print = () => {
    // Geen await vóór de print — print moet binnen dezelfde
    // user-gesture stack uitgevoerd worden. Save loopt parallel.
    void ensureBriefOpgeslagen('concept');
    if (typeof window === 'undefined') return;
    const iframe = printIframeRef.current;
    if (!iframe) {
      toast.error('Printen mislukt. Probeer opnieuw of gebruik "Kopieer brief".');
      return;
    }
    const html = bouwPrintbareHtml({
      eigenaarNaam, eigenaarBedrijfsnaam,
      verzendadres: verzendadresVoorOpslag() ?? '',
      onderwerp, brieftekst,
      logoUrl: typeof window !== 'undefined'
        ? new URL(bitoLogo, window.location.origin).href
        : undefined,
    });
    try {
      iframe.srcdoc = html;
      // Wacht op load → trigger print binnen iframe.
      const onLoad = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print mislukt', e);
          toast.error('Printen mislukt. Gebruik "Kopieer brief" als fallback.');
        } finally {
          iframe.removeEventListener('load', onLoad);
        }
      };
      iframe.addEventListener('load', onLoad);
    } catch (e) {
      console.warn('Print voorbereiding mislukt', e);
      toast.error('Printen mislukt. Gebruik "Kopieer brief" als fallback.');
    }
  };

  const markeerVerstuurd = async () => {
    if (!isEchteWaarde(verzendadres)) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Er is geen verzendadres ingevuld. Weet u zeker dat u deze brief als verstuurd wilt markeren?')
        : true;
      if (!ok) return;
    }
    setBezig(true);
    try {
      let id = briefId;
      if (!id) {
        id = await ensureBriefOpgeslagen('concept');
        if (!id) return;
      }
      await markVerstuurd.mutateAsync(id);

      try {
        await addTaak({
          titel: 'Brief opvolgen',
          type: 'Follow-up',
          deadline: deadlineOverDagen(14),
          prioriteit: 'normaal',
          status: 'open',
          offMarketSignaalId: signaal.id,
          notities: `Brief verzonden naar ${eigenaarBedrijfsnaam || eigenaarNaam || 'eigenaar/rechthebbende'} (${objectomschrijving || objectadres || signaal.titel}).`,
        } as any);
      } catch (e) {
        console.warn('Opvolgtaak aanmaken mislukt', e);
      }

      try {
        await logSystemContactMoment({
          type: 'notitie',
          title: 'Brief verzonden',
          description: `Brief verzonden naar eigenaar/rechthebbende: ${eigenaarBedrijfsnaam || eigenaarNaam || '—'}${(objectomschrijving || objectadres) ? ` · ${objectomschrijving || objectadres}` : ''}.`,
          offMarketSignaalId: signaal.id,
          relatieId: (signaal as any).eigenaar_relatie_id ?? null,
          systemKey: `off_market_brief_verstuurd:${id}`,
        });
      } catch (e) {
        console.warn('Contactmoment loggen mislukt', e);
      }

      toast.success('Brief gemarkeerd als verstuurd');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Markeren als verstuurd mislukt');
    } finally {
      setBezig(false);
    }
  };

  const kandidaten = prefill.kandidaten;
  const verzendadresOntbreekt = !isEchteWaarde(verzendadres);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Brief voorbereiden
          </DialogTitle>
          <DialogDescription>
            Controleer de geadresseerde, het verzendadres en de
            objectomschrijving in de brief. De brief wordt als concept
            opgeslagen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" data-testid="brief-voorbereiden-dialog">
          {kandidaten.length > 1 && (
            <div className="space-y-1.5">
              <Label>Geadresseerde kiezen</Label>
              <Select value={kandidaatLabel} onValueChange={handleKandidaatWissel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {kandidaten.map(k => (
                    <SelectItem key={k.label} value={k.label}>
                      {k.label}{' '}
                      <span className="text-[10px] text-muted-foreground">
                        ({k.bron === 'kadaster' ? 'Kadaster' : 'Signaal'})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Blok 1 — Geadresseerde */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Geadresseerde</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brief-naam">Naam</Label>
                <Input id="brief-naam" value={eigenaarNaam}
                  onChange={(e) => {
                    setEigenaarNaam(e.target.value);
                    const a = bepaalAanhef(e.target.value || null);
                    setAanhef(a);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brief-bedrijf">Bedrijfsnaam</Label>
                <Input id="brief-bedrijf" value={eigenaarBedrijfsnaam} onChange={(e) => setEigenaarBedrijfsnaam(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Blok 2 — Verzendadres */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Verzendadres</div>
            <Label htmlFor="brief-verzend" className="sr-only">Verzendadres</Label>
            <Textarea
              id="brief-verzend"
              value={verzendadres}
              onChange={(e) => setVerzendadres(e.target.value)}
              placeholder={VERZENDADRES_PLACEHOLDER}
              rows={3}
            />
            {verzendadresOntbreekt && (
              <p className="text-[11px] text-amber-600">
                Geen verzendadres bekend. Vul dit handmatig aan voordat u de brief print.
              </p>
            )}
          </div>

          {/* Blok 3 — Objectomschrijving in brief */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Objectomschrijving in brief</div>
            <Label htmlFor="brief-objomschrijving" className="sr-only">Objectomschrijving</Label>
            <Input
              id="brief-objomschrijving"
              value={objectomschrijving}
              onChange={(e) => {
                setObjectomschrijving(e.target.value);
                setBrieftekst(bouwBriefTekst({ aanhef, objectadres: e.target.value }));
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Gebaseerd op signaaladres / Kadasteradres. Pas dit aan als het
              signaal meerdere adressen of een breder pand betreft.
            </p>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Intern objectadres (feitelijk)</summary>
            <div className="pt-2">
              <Input value={objectadres} onChange={(e) => setObjectadres(e.target.value)} />
              <p className="mt-1 text-[11px]">
                Wordt bewaard voor administratie. De brief gebruikt
                "Objectomschrijving in brief".
              </p>
            </div>
          </details>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brief-aanhef">Aanhef</Label>
              <Input id="brief-aanhef" value={aanhef} onChange={(e) => setAanhef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brief-onderwerp">Onderwerp</Label>
              <Input id="brief-onderwerp" value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="brief-tekst">Brieftekst</Label>
              <button
                type="button"
                onClick={herstelStandaard}
                className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Herstel standaardtekst
              </button>
            </div>
            <Textarea
              id="brief-tekst"
              value={brieftekst}
              onChange={(e) => setBrieftekst(e.target.value)}
              rows={18}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Verborgen print-iframe — vermijdt pop-up blocker. */}
          <iframe
            ref={printIframeRef}
            title="Brief print"
            aria-hidden="true"
            tabIndex={-1}
            style={{
              position: 'fixed', right: 0, bottom: 0,
              width: 0, height: 0, border: 0, opacity: 0, pointerEvents: 'none',
            }}
          />
        </div>

        <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>
          <Button variant="outline" onClick={kopieer}>
            <Copy className="h-4 w-4" /> Kopieer brief
          </Button>
          <Button variant="outline" onClick={print}>
            <Printer className="h-4 w-4" /> Print brief / Opslaan als PDF
          </Button>
          <Button onClick={markeerVerstuurd} disabled={bezig}>
            <Send className="h-4 w-4" /> Markeer als verstuurd
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Printbare HTML — professionele Bito Vastgoed A4-brief.
//
// Bewust een dedicated A4-template:
//  - eigen <html> binnen verborgen iframe → geen app/modal styling;
//  - alleen inline CSS, geen externe stylesheets;
//  - logo via absolute URL (data-URL/asset URL) ingebed wanneer beschikbaar,
//    anders een nette tekstfallback;
//  - de brieftekst bevat reeds de afsluiting / handtekening — er wordt
//    daarom géén tweede handtekeningblok toegevoegd.
// ---------------------------------------------------------------------
export function bouwPrintbareHtml(input: {
  eigenaarNaam: string;
  eigenaarBedrijfsnaam: string;
  verzendadres: string;
  onderwerp: string;
  brieftekst: string;
  logoUrl?: string;
}): string {
  // Placeholdertekst mag nooit in een printbare brief verschijnen.
  const veiligVerzend = isEchteWaarde(input.verzendadres) ? input.verzendadres : '';
  const geadresseerde = bouwGeadresseerdeBlok({
    naam: input.eigenaarNaam,
    bedrijfsnaam: input.eigenaarBedrijfsnaam,
    verzendadres: veiligVerzend,
  });
  const datum = formatDatumNL();
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const logoBlok = input.logoUrl
    ? `<img class="logo-img" src="${esc(input.logoUrl)}" alt="Bito Vastgoed" />`
    : `<div class="logo-fallback" aria-hidden="true">B</div>`;

  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8" />
<title>Brief — ${esc(BITO_CONTACT.bedrijf)} — ${esc(input.onderwerp)}</title>
<style>
  @page { size: A4 portrait; margin: 20mm 22mm; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    font-size: 10.75pt;
    line-height: 1.5;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }
  .sheet { width: 100%; max-width: 170mm; margin: 0 auto; }
  .header {
    display: flex;
    align-items: flex-start;
    gap: 14mm;
    padding-bottom: 6mm;
    border-bottom: 0.5pt solid #c89c69;
    margin-bottom: 12mm;
  }
  .logo { flex: 0 0 auto; }
  .logo-img { display: block; height: 18mm; width: auto; }
  .logo-fallback {
    width: 14mm; height: 14mm;
    display: flex; align-items: center; justify-content: center;
    border: 1pt solid #c89c69; color: #c89c69;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22pt; font-weight: 700;
  }
  .brand { flex: 1 1 auto; padding-top: 1mm; }
  .brand-naam {
    font-size: 13pt; font-weight: 700; letter-spacing: 0.18em;
    color: #1a1a1a; text-transform: uppercase;
  }
  .brand-tagline {
    margin-top: 1.5mm;
    font-size: 9pt; color: #6b6b6b; font-style: italic; letter-spacing: 0.02em;
  }
  .addressee {
    margin-bottom: 14mm;
    line-height: 1.45;
  }
  .addressee .line { display: block; }
  .meta {
    display: flex; justify-content: space-between; align-items: flex-end;
    margin-bottom: 10mm;
  }
  .datum { font-size: 10.5pt; color: #1a1a1a; }
  .onderwerp {
    margin: 0 0 8mm 0;
    font-size: 11pt; font-weight: 600; color: #1a1a1a;
  }
  .body {
    white-space: pre-wrap;
    font-size: 10.75pt;
    line-height: 1.55;
    color: #1a1a1a;
    /* Zorg dat de brief normaal gesproken op één pagina past en
       afsluiting niet los van laatste alinea afbreekt. */
    orphans: 3;
    widows: 3;
  }
  .footer-rule {
    margin-top: 14mm;
    border-top: 0.5pt solid #e7d9c2;
    padding-top: 3mm;
    font-size: 8pt; color: #8a8a8a; text-align: center; letter-spacing: 0.04em;
  }
  @media print {
    body { font-size: 10.75pt; }
    .noprint { display: none !important; }
  }
</style>
</head><body>
<div class="sheet">
  <div class="header">
    <div class="logo">${logoBlok}</div>
    <div class="brand">
      <div class="brand-naam">${esc(BITO_CONTACT.bedrijf)}</div>
      <div class="brand-tagline">Onafhankelijk. Gericht. Discreet.</div>
    </div>
  </div>

  <div class="addressee">
    ${geadresseerde.length > 0
      ? geadresseerde.map(l => `<span class="line">${esc(l)}</span>`).join('')
      : ''}
  </div>

  <div class="meta">
    <div class="datum">${esc(datum)}</div>
  </div>

  <p class="onderwerp">Betreft: ${esc(input.onderwerp)}</p>

  <div class="body">${esc(input.brieftekst)}</div>

  <div class="footer-rule">${esc(BITO_CONTACT.bedrijf)} · ${esc(BITO_CONTACT.website)}</div>
</div>
</body></html>`;
}
