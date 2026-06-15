// BriefVoorbereidenDialog — V1 Off-Market signaal.
//
// Genereert een conceptbrief op basis van eigenaar/rechthebbende +
// objectadres + vaste Bito Vastgoed-contactgegevens. De gebruiker kan
// controleren, aanpassen, kopiëren, printen/als PDF opslaan en markeren
// als verstuurd. Bij "Markeer als verstuurd" wordt automatisch een
// opvolgtaak (14 dagen) en een contactmoment (type "notitie") aangemaakt.
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Printer, Send, FileText } from 'lucide-react';
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
  formatDatumNL, BITO_CONTACT,
  type EigenaarKandidaat,
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

export default function BriefVoorbereidenDialog({
  open, onOpenChange, signaal, kadasterRecords,
}: Props) {
  const prefill = useMemo(
    () => bouwBriefPrefill(signaal, kadasterRecords),
    // We willen bij elke open opnieuw prefillen vanuit signaal/records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signaal.id, kadasterRecords.length, open],
  );

  const [kandidaatLabel, setKandidaatLabel] = useState<string>(prefill.kandidaten[0]?.label ?? '');
  const [eigenaarNaam, setEigenaarNaam] = useState(prefill.eigenaarNaam);
  const [eigenaarBedrijfsnaam, setEigenaarBedrijfsnaam] = useState(prefill.eigenaarBedrijfsnaam);
  const [verzendadres, setVerzendadres] = useState(prefill.verzendadres);
  const [objectadres, setObjectadres] = useState(prefill.objectadres);
  const [aanhef, setAanhef] = useState(prefill.aanhef);
  const [onderwerp, setOnderwerp] = useState(prefill.onderwerp);
  const [brieftekst, setBrieftekst] = useState(prefill.brieftekst);
  const [briefId, setBriefId] = useState<string | null>(null);
  const briefRef = useRef<HTMLDivElement>(null);
  const [bezig, setBezig] = useState(false);

  // Reset bij heropenen.
  useEffect(() => {
    if (!open) return;
    setKandidaatLabel(prefill.kandidaten[0]?.label ?? '');
    setEigenaarNaam(prefill.eigenaarNaam);
    setEigenaarBedrijfsnaam(prefill.eigenaarBedrijfsnaam);
    setVerzendadres(prefill.verzendadres);
    setObjectadres(prefill.objectadres);
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
      setBrieftekst(bouwBriefTekst({ aanhef: nieuweAanhef, objectadres }));
    }
  };

  // Houd brieftekst gesync. met aanhef + objectadres als gebruiker die wijzigt.
  // Maar respecteer eigen edits aan brieftekst: alleen herbouwen als de tekst
  // exact gelijk is aan eerder gegenereerde standaardtekst. Eenvoud: bied
  // expliciete "Brieftekst herstellen"-knop.

  const herstelStandaard = () => {
    setBrieftekst(bouwBriefTekst({ aanhef, objectadres }));
    toast.success('Standaardtekst hersteld');
  };

  const ensureBriefOpgeslagen = async (status: 'concept' | 'verstuurd' = 'concept'): Promise<string | null> => {
    try {
      const res = await upsert.mutateAsync({
        id: briefId ?? undefined,
        signaal_id: signaal.id,
        eigenaar_naam: eigenaarNaam || null,
        eigenaar_bedrijfsnaam: eigenaarBedrijfsnaam || null,
        verzendadres: verzendadres || null,
        objectadres: objectadres || null,
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

  const print = async () => {
    // Sla concept op zodat een gedrukte brief altijd traceerbaar is.
    await ensureBriefOpgeslagen('concept');
    // Print via een verborgen iframe zodat de pagina niet wordt herladen.
    if (typeof window === 'undefined') return;
    const html = bouwPrintbareHtml({
      eigenaarNaam, eigenaarBedrijfsnaam, verzendadres,
      onderwerp, brieftekst,
    });
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!w) {
      toast.error('Pop-up geblokkeerd. Sta pop-ups toe om te kunnen printen.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Wacht op render, dan print-dialoog openen.
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* leeg */ } }, 250);
  };

  const markeerVerstuurd = async () => {
    setBezig(true);
    try {
      let id = briefId;
      if (!id) {
        id = await ensureBriefOpgeslagen('concept');
        if (!id) return;
      }
      await markVerstuurd.mutateAsync(id);

      // Opvolgtaak (14 dagen). Bestaande taken-flow; bewust geen nieuw type
      // forceren.
      try {
        await addTaak({
          titel: 'Brief opvolgen',
          type: 'Follow-up',
          deadline: deadlineOverDagen(14),
          prioriteit: 'normaal',
          status: 'open',
          offMarketSignaalId: signaal.id,
          notities: `Brief verzonden naar ${eigenaarBedrijfsnaam || eigenaarNaam || 'eigenaar/rechthebbende'} (${objectadres || signaal.titel}).`,
        } as any);
      } catch (e) {
        console.warn('Opvolgtaak aanmaken mislukt', e);
      }

      // Contactmoment loggen. 'brief' is geen bestaande enum-waarde — gebruik
      // 'notitie' met duidelijke omschrijving, zoals opdracht voorschrijft.
      try {
        await logSystemContactMoment({
          type: 'notitie',
          title: 'Brief verzonden',
          description: `Brief verzonden naar eigenaar/rechthebbende: ${eigenaarBedrijfsnaam || eigenaarNaam || '—'}${objectadres ? ` · ${objectadres}` : ''}.`,
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
  const verzendadresOntbreekt = !verzendadres.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Brief voorbereiden
          </DialogTitle>
          <DialogDescription>
            Controleer en pas zo nodig de geadresseerde, het verzendadres en
            de brieftekst aan. De brief wordt als concept opgeslagen.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brief-naam">Eigenaar / contactpersoon</Label>
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

          <div className="space-y-1.5">
            <Label htmlFor="brief-verzend">Verzendadres</Label>
            <Textarea
              id="brief-verzend"
              value={verzendadres}
              onChange={(e) => setVerzendadres(e.target.value)}
              placeholder="Straat 1&#10;1234 AB Plaats"
              rows={3}
            />
            {verzendadresOntbreekt && (
              <p className="text-[11px] text-amber-600">
                Geen verzendadres bekend. Vul dit handmatig aan voordat u de brief print.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brief-object">Objectadres</Label>
            <Input id="brief-object" value={objectadres} onChange={(e) => {
              setObjectadres(e.target.value);
              setBrieftekst(bouwBriefTekst({ aanhef, objectadres: e.target.value }));
            }} />
          </div>

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

          {/* Hidden preview voor screenreaders / tests. */}
          <div ref={briefRef} className="sr-only" aria-hidden="true">
            {brieftekst}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>
          <Button variant="outline" onClick={kopieer}>
            <Copy className="h-4 w-4" /> Kopieer brief
          </Button>
          <Button variant="outline" onClick={print}>
            <Printer className="h-4 w-4" /> Print / Download als PDF
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
// Printbare HTML — bewust zonder externe assets zodat browser-print
// betrouwbaar is, ook op mobiel. Gebruiker kan via "Opslaan als PDF" in
// de print-dialoog een PDF maken.
// ---------------------------------------------------------------------
export function bouwPrintbareHtml(input: {
  eigenaarNaam: string;
  eigenaarBedrijfsnaam: string;
  verzendadres: string;
  onderwerp: string;
  brieftekst: string;
}): string {
  const geadresseerde = bouwGeadresseerdeBlok({
    naam: input.eigenaarNaam,
    bedrijfsnaam: input.eigenaarBedrijfsnaam,
    verzendadres: input.verzendadres,
  });
  const datum = formatDatumNL();
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8" />
<title>Brief — ${esc(input.onderwerp)}</title>
<style>
  @page { size: A4; margin: 25mm 22mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 11pt; line-height: 1.55; }
  .hdr { text-align: right; font-size: 10pt; color: #444; margin-bottom: 18mm; }
  .ge { margin-bottom: 12mm; white-space: pre-line; }
  .meta { margin-bottom: 8mm; }
  .meta .datum { color: #444; }
  .meta .ondw { font-weight: 600; margin-top: 6mm; }
  .body { white-space: pre-wrap; }
  @media print { .noprint { display: none; } }
</style>
</head><body>
<div class="hdr">
  ${esc(BITO_CONTACT.bedrijf)}<br/>
  ${esc(BITO_CONTACT.naam)} — ${esc(BITO_CONTACT.functie)}<br/>
  T ${esc(BITO_CONTACT.telefoon)} · E ${esc(BITO_CONTACT.email)} · ${esc(BITO_CONTACT.website)}
</div>
<div class="ge">${geadresseerde.map(esc).join('<br/>') || '<em>Geen verzendadres</em>'}</div>
<div class="meta">
  <div class="datum">${esc(datum)}</div>
  <div class="ondw">Betreft: ${esc(input.onderwerp)}</div>
</div>
<div class="body">${esc(input.brieftekst)}</div>
</body></html>`;
}
