import { useMemo, useRef, useState, useCallback } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  type AssetClass,
  type Energielabel,
  type ReferentieObject,
  type VerhuurStatus,
} from '@/data/mock-data';
import { toast } from 'sonner';
import {
  Upload, FileText, Download, AlertCircle, CheckCircle2,
  AlertTriangle, ArrowLeft, ArrowRight, Loader2, X,
} from 'lucide-react';

// =====================================================================
// Constants
// =====================================================================

type DoelVeld =
  | 'adres' | 'postcode' | 'plaats' | 'm2' | 'vraagprijs'
  | 'asset_class' | 'bouwjaar' | 'energielabel' | 'huurstatus'
  | 'huurprijs_per_maand' | 'huurprijs_per_jaar' | 'bron' | 'notities'
  | '__skip__';

const VELD_LABELS: Record<DoelVeld, string> = {
  adres: 'Adres *',
  postcode: 'Postcode *',
  plaats: 'Plaats *',
  m2: 'Oppervlakte (m²) *',
  vraagprijs: 'Vraagprijs *',
  asset_class: 'Asset class',
  bouwjaar: 'Bouwjaar',
  energielabel: 'Energielabel',
  huurstatus: 'Huurstatus',
  huurprijs_per_maand: 'Huur per maand',
  huurprijs_per_jaar: 'Huur per jaar',
  bron: 'Bron',
  notities: 'Notities',
  __skip__: '— Negeren —',
};

const VERPLICHTE_VELDEN: DoelVeld[] = ['adres', 'postcode', 'plaats', 'm2', 'vraagprijs'];

const ASSET_CLASSES: AssetClass[] = [
  'wonen','winkels','bedrijfshallen','logistiek','industrieel',
  'kantoren','hotels','zorgvastgoed','mixed_use','ontwikkellocatie',
];

const ENERGIELABELS: Energielabel[] = [
  'A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend',
];

const HUURSTATUSSEN: VerhuurStatus[] = ['verhuurd', 'leeg', 'gedeeltelijk'];

// =====================================================================
// Header guesser
// =====================================================================

function raadVeld(header: string): DoelVeld {
  const h = header.trim().toLowerCase().replace(/[_\-\s]+/g, '');
  if (/^(adres|address|straat)/.test(h)) return 'adres';
  if (/^(postcode|zip|postal)/.test(h)) return 'postcode';
  if (/^(plaats|stad|city|woonplaats)/.test(h)) return 'plaats';
  if (h.includes('huurperjaar') || h.includes('yearlyrent') || h.includes('huurjaar')) return 'huurprijs_per_jaar';
  if (h.includes('huurpermaand') || h.includes('huurmaand') || h.includes('rent') || h.startsWith('huurprijs') || h === 'huur') return 'huurprijs_per_maand';
  if (/^(m2|m²|oppervlak|vvo|bvo|gbo|size|surface)/.test(h)) return 'm2';
  if (/^(vraagprijs|prijs|price|asking)/.test(h)) return 'vraagprijs';
  if (/^(type|asset|category|categorie)/.test(h)) return 'asset_class';
  if (/^(bouwjaar|year|yearbuilt)/.test(h)) return 'bouwjaar';
  if (/^(energielabel|label|energy)/.test(h)) return 'energielabel';
  if (/^(huurstatus|status|rental|verhuurstatus)/.test(h)) return 'huurstatus';
  if (/^(bron|source)/.test(h)) return 'bron';
  if (/^(notitie|notes|opmerking|remark)/.test(h)) return 'notities';
  return '__skip__';
}

// =====================================================================
// Parsers
// =====================================================================

interface RuweRij {
  velden: Record<string, string>;
  rijIndex: number;
}

function parsePastedTSV(text: string): { headers: string[]; rijen: RuweRij[] } {
  const regels = text.replace(/\r\n/g, '\n').split('\n').filter(r => r.trim().length > 0);
  if (regels.length === 0) return { headers: [], rijen: [] };
  const sep = regels[0].includes('\t') ? '\t' : (regels[0].includes(';') ? ';' : ',');
  const headers = regels[0].split(sep).map(h => h.trim());
  const rijen: RuweRij[] = regels.slice(1).map((regel, idx) => {
    const cellen = regel.split(sep);
    const velden: Record<string, string> = {};
    headers.forEach((h, i) => { velden[h] = (cellen[i] ?? '').trim(); });
    return { velden, rijIndex: idx };
  });
  return { headers, rijen };
}

function parseCSV(file: File): Promise<{ headers: string[]; rijen: RuweRij[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const rijen: RuweRij[] = (res.data as any[]).map((row, idx) => {
          const velden: Record<string, string> = {};
          headers.forEach(h => { velden[h] = String(row[h] ?? '').trim(); });
          return { velden, rijIndex: idx };
        });
        resolve({ headers, rijen });
      },
      error: (err) => reject(err),
    });
  });
}

// =====================================================================
// Value parsers + validation
// =====================================================================

function parseNummer(raw: string): number | null {
  if (!raw) return null;
  // Strip € en whitespace, behandel zowel comma als punt
  let s = raw.replace(/[€\s]/g, '').trim();
  if (!s) return null;
  // Als er én een . én een , in zit: laatste = decimaal scheidingsteken
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // 1.234,56 → 1234.56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 → 1234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // alleen komma → decimaal of duizendtal
    // als precies 3 cijfers na de komma → duizendtal
    const after = s.length - lastComma - 1;
    if (after === 3) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normaliseerPostcode(raw: string): { ok: boolean; waarde: string } {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (/^[1-9][0-9]{3}[A-Z]{2}$/.test(s)) {
    return { ok: true, waarde: `${s.slice(0, 4)} ${s.slice(4)}` };
  }
  return { ok: false, waarde: raw };
}

interface Verwerkt {
  rijIndex: number;
  data: Partial<ReferentieObject>;
  fouten: string[];        // blokkerend
  waarschuwingen: string[]; // niet blokkerend
  duplicaatVan?: string;   // id van bestaand referentieobject
}

function verwerkRij(
  ruw: RuweRij,
  mapping: Record<string, DoelVeld>,
  bestaande: ReferentieObject[],
): Verwerkt {
  const fouten: string[] = [];
  const waarschuwingen: string[] = [];
  const data: any = {};

  // Verzamel waarden per doelveld (laatste wint indien meerdere kolommen mappen)
  for (const [header, doel] of Object.entries(mapping)) {
    if (doel === '__skip__') continue;
    const waarde = ruw.velden[header] ?? '';
    if (!waarde) continue;

    switch (doel) {
      case 'adres': data.adres = waarde; break;
      case 'plaats': data.plaats = waarde; break;
      case 'postcode': {
        const pc = normaliseerPostcode(waarde);
        if (!pc.ok) fouten.push(`Postcode "${waarde}" heeft ongeldig formaat`);
        data.postcode = pc.waarde;
        break;
      }
      case 'm2': {
        const n = parseNummer(waarde);
        if (n == null || n <= 0) fouten.push(`m² "${waarde}" is geen positief getal`);
        else data.m2 = Math.round(n);
        break;
      }
      case 'vraagprijs': {
        const n = parseNummer(waarde);
        if (n == null || n <= 0) fouten.push(`Vraagprijs "${waarde}" is geen positief getal`);
        else data.vraagprijs = Math.round(n);
        break;
      }
      case 'bouwjaar': {
        const n = parseNummer(waarde);
        const huidig = new Date().getFullYear();
        if (n == null || !Number.isFinite(n)) waarschuwingen.push(`Bouwjaar "${waarde}" niet leesbaar`);
        else if (n < 1800 || n > huidig + 5) waarschuwingen.push(`Bouwjaar ${n} buiten bereik`);
        else data.bouwjaar = Math.round(n);
        break;
      }
      case 'asset_class': {
        const w = waarde.toLowerCase().replace(/[\s\-]+/g, '_');
        if ((ASSET_CLASSES as string[]).includes(w)) {
          data.assetClass = w as AssetClass;
        } else {
          // Probeer matching via labels
          const viaLabel = (Object.entries(ASSET_CLASS_LABELS) as [AssetClass, string][])
            .find(([, lab]) => lab.toLowerCase() === waarde.toLowerCase());
          if (viaLabel) data.assetClass = viaLabel[0];
          else waarschuwingen.push(`Asset class "${waarde}" onbekend, leeg gelaten`);
        }
        break;
      }
      case 'energielabel': {
        const w = waarde.toUpperCase().trim();
        if ((ENERGIELABELS as string[]).includes(w)) data.energielabel = w as Energielabel;
        else waarschuwingen.push(`Energielabel "${waarde}" onbekend, leeg gelaten`);
        break;
      }
      case 'huurstatus': {
        const w = waarde.toLowerCase().trim();
        if ((HUURSTATUSSEN as string[]).includes(w)) data.huurstatus = w as VerhuurStatus;
        else waarschuwingen.push(`Huurstatus "${waarde}" onbekend, leeg gelaten`);
        break;
      }
      case 'huurprijs_per_maand': {
        const n = parseNummer(waarde);
        if (n != null && n > 0) data.huurprijsPerMaand = Math.round(n);
        break;
      }
      case 'huurprijs_per_jaar': {
        const n = parseNummer(waarde);
        if (n != null && n > 0) data.huurprijsPerJaar = Math.round(n);
        break;
      }
      case 'bron': data.bron = waarde; break;
      case 'notities': data.notities = waarde; break;
    }
  }

  // Verplichte velden
  for (const v of VERPLICHTE_VELDEN) {
    const sleutel = v === 'm2' ? 'm2' : v === 'asset_class' ? 'assetClass' : v;
    if (data[sleutel] == null || data[sleutel] === '') {
      // Vermijd dubbele meldingen als er al een specifieke fout staat
      const reedsGemeld = fouten.some(f => f.toLowerCase().includes(VELD_LABELS[v].split(' ')[0].toLowerCase()));
      if (!reedsGemeld) fouten.push(`${VELD_LABELS[v].replace(' *','')} ontbreekt`);
    }
  }

  // Default bouwjaar (DB vereist NOT NULL) — we vullen 0 als niet aanwezig… nee: maak fout niet, val terug op 1900 met waarschuwing
  if (data.bouwjaar == null) {
    // bouwjaar is in DB NOT NULL; gebruik 0 zou misleidend zijn. Markeer als fout zodat gebruiker bewust kiest.
    fouten.push('Bouwjaar ontbreekt (verplicht in database)');
  }

  // Duplicate-detectie
  if (data.adres && data.postcode) {
    const adresN = String(data.adres).toLowerCase().trim();
    const pcN = String(data.postcode).toLowerCase().replace(/\s+/g, '');
    const dup = bestaande.find(b =>
      !b.softDeletedAt &&
      b.adres.toLowerCase().trim() === adresN &&
      b.postcode.toLowerCase().replace(/\s+/g, '') === pcN
    );
    if (dup) return { rijIndex: ruw.rijIndex, data, fouten, waarschuwingen, duplicaatVan: dup.id };
  }

  return { rijIndex: ruw.rijIndex, data, fouten, waarschuwingen };
}

// =====================================================================
// Voorbeeld-CSV
// =====================================================================

function downloadVoorbeeldCSV() {
  const headers = ['adres','postcode','plaats','asset_class','m2','vraagprijs','bouwjaar','energielabel','huurstatus','huurprijs_per_jaar','bron','notities'];
  const voorbeelden = [
    ['Keizersgracht 123','1015 CJ','Amsterdam','kantoren','850','3250000','1920','C','verhuurd','185000','Funda in business','Monumentaal pand, 4 verdiepingen'],
    ['Industrieweg 45','3542 AD','Utrecht','logistiek','4200','5800000','2008','A','verhuurd','420000','Off-market','Recent gerenoveerd, lange huurder'],
  ];
  const csv = [headers, ...voorbeelden]
    .map(rij => rij.map(v => /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'referentieobjecten-voorbeeld.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =====================================================================
// Hoofdcomponent
// =====================================================================

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stap = 'invoer' | 'mapping' | 'preview' | 'importeren' | 'klaar';

export default function ReferentieObjectBulkImportDialog({ open, onOpenChange }: Props) {
  const store = useDataStore();
  const [stap, setStap] = useState<Stap>('invoer');
  const [tabblad, setTabblad] = useState<'csv' | 'paste'>('csv');
  const [pasteText, setPasteText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [ruweRijen, setRuweRijen] = useState<RuweRij[]>([]);
  const [mapping, setMapping] = useState<Record<string, DoelVeld>>({});
  const [verwerkt, setVerwerkt] = useState<Verwerkt[]>([]);
  const [geselecteerd, setGeselecteerd] = useState<Set<number>>(new Set());
  const [overschrijven, setOverschrijven] = useState<Set<number>>(new Set());
  const [voortgang, setVoortgang] = useState(0);
  const [voortgangTotaal, setVoortgangTotaal] = useState(0);
  const [importFouten, setImportFouten] = useState<Map<number, string>>(new Map());
  const [dragActief, setDragActief] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStap('invoer');
    setTabblad('csv');
    setPasteText('');
    setHeaders([]);
    setRuweRijen([]);
    setMapping({});
    setVerwerkt([]);
    setGeselecteerd(new Set());
    setOverschrijven(new Set());
    setVoortgang(0);
    setVoortgangTotaal(0);
    setImportFouten(new Map());
    setDragActief(false);
  }, []);

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  // ---------- Stap 1 → 2: parsing ----------
  const verwerkInvoer = (h: string[], r: RuweRij[]) => {
    if (h.length === 0 || r.length === 0) {
      toast.error('Geen rijen gevonden');
      return;
    }
    setHeaders(h);
    setRuweRijen(r);
    const initMap: Record<string, DoelVeld> = {};
    h.forEach(header => { initMap[header] = raadVeld(header); });
    setMapping(initMap);
    setStap('mapping');
  };

  const handleFile = async (file: File) => {
    try {
      const { headers: h, rijen: r } = await parseCSV(file);
      verwerkInvoer(h, r);
    } catch (e: any) {
      toast.error(`CSV inlezen mislukt: ${e?.message ?? 'onbekend'}`);
    }
  };

  const handlePaste = () => {
    const { headers: h, rijen: r } = parsePastedTSV(pasteText);
    verwerkInvoer(h, r);
  };

  // ---------- Stap 2 → 3: validatie ----------
  const naarPreview = () => {
    // Check verplichte mapping
    const gemapt = new Set(Object.values(mapping));
    const ontbrekend = VERPLICHTE_VELDEN.filter(v => !gemapt.has(v));
    if (ontbrekend.length > 0) {
      toast.error(`Verplichte velden niet gemapt: ${ontbrekend.map(v => VELD_LABELS[v].replace(' *','')).join(', ')}`);
      return;
    }
    const result = ruweRijen.map(r => verwerkRij(r, mapping, store.referentieObjecten));
    setVerwerkt(result);
    // Default selectie: valide rijen aan, duplicates en ongeldig uit
    const sel = new Set<number>();
    result.forEach(v => {
      if (v.fouten.length === 0 && !v.duplicaatVan) sel.add(v.rijIndex);
    });
    setGeselecteerd(sel);
    setOverschrijven(new Set());
    setStap('preview');
  };

  // ---------- Stap 3 → 4: importeren ----------
  const startImport = async () => {
    const teVerwerken = verwerkt.filter(v => geselecteerd.has(v.rijIndex) && v.fouten.length === 0);
    if (teVerwerken.length === 0) {
      toast.error('Geen rijen geselecteerd');
      return;
    }
    setStap('importeren');
    setVoortgangTotaal(teVerwerken.length);
    setVoortgang(0);
    const fouten = new Map<number, string>();
    let geslaagd = 0;

    const BATCH = 10;
    for (let i = 0; i < teVerwerken.length; i += BATCH) {
      const batch = teVerwerken.slice(i, i + BATCH);
      await Promise.all(batch.map(async (rij) => {
        try {
          const payload: any = {
            adres: rij.data.adres,
            postcode: rij.data.postcode,
            plaats: rij.data.plaats,
            m2: rij.data.m2,
            vraagprijs: rij.data.vraagprijs,
            bouwjaar: rij.data.bouwjaar ?? 0,
            assetClass: rij.data.assetClass ?? 'kantoren',
            energielabel: rij.data.energielabel,
            huurstatus: rij.data.huurstatus,
            huurprijsPerMaand: rij.data.huurprijsPerMaand,
            huurprijsPerJaar: rij.data.huurprijsPerJaar,
            bron: rij.data.bron,
            notities: rij.data.notities,
          };
          if (rij.duplicaatVan && overschrijven.has(rij.rijIndex)) {
            await store.updateReferentieObject(rij.duplicaatVan, payload);
          } else {
            await store.addReferentieObject(payload);
          }
          geslaagd++;
        } catch (e: any) {
          fouten.set(rij.rijIndex, e?.message ?? 'Onbekende fout');
        }
      }));
      setVoortgang(Math.min(i + BATCH, teVerwerken.length));
    }

    setImportFouten(fouten);
    if (fouten.size === 0) {
      toast.success(`${geslaagd} referentie(s) geïmporteerd`);
      handleClose(false);
    } else {
      toast.warning(`${geslaagd} geïmporteerd, ${fouten.size} mislukt`);
      setStap('preview');
    }
  };

  // ---------- Tellers ----------
  const tellers = useMemo(() => {
    const valide = verwerkt.filter(v => v.fouten.length === 0 && !v.duplicaatVan).length;
    const dup = verwerkt.filter(v => v.fouten.length === 0 && v.duplicaatVan).length;
    const fout = verwerkt.filter(v => v.fouten.length > 0).length;
    return { valide, dup, fout, totaal: verwerkt.length };
  }, [verwerkt]);

  const gemapteVelden = useMemo(() => new Set(Object.values(mapping)), [mapping]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-accent" />
            Referentieobjecten bulk importeren
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {stap === 'invoer' && '1 / 4 — Invoer'}
              {stap === 'mapping' && '2 / 4 — Kolom-mapping'}
              {stap === 'preview' && '3 / 4 — Voorbeeld'}
              {stap === 'importeren' && '4 / 4 — Importeren'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-5">

          {/* ============= STAP 1: INVOER ============= */}
          {stap === 'invoer' && (
            <Tabs value={tabblad} onValueChange={(v) => setTabblad(v as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="csv">CSV uploaden</TabsTrigger>
                <TabsTrigger value="paste">Plak vanuit Excel</TabsTrigger>
              </TabsList>

              <TabsContent value="csv" className="space-y-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActief(true); }}
                  onDragLeave={() => setDragActief(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActief(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                    dragActief ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-muted/30'
                  }`}
                >
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Sleep een CSV hierheen of klik om te kiezen</p>
                  <p className="text-xs text-muted-foreground mt-1">Eerste rij wordt als header gelezen</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = '';
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Ondersteund: komma- en puntkomma-gescheiden CSV met headers</span>
                  <Button variant="ghost" size="sm" onClick={downloadVoorbeeldCSV} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Voorbeeld CSV
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Selecteer cellen in Excel/Google Sheets (incl. header-rij) en plak hieronder met Cmd/Ctrl-V.
                  </p>
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={'adres\tpostcode\tplaats\tm2\tvraagprijs\nKeizersgracht 123\t1015 CJ\tAmsterdam\t850\t3250000'}
                    className="font-mono text-xs min-h-[240px]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={downloadVoorbeeldCSV} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Voorbeeld CSV
                  </Button>
                  <Button onClick={handlePaste} disabled={!pasteText.trim()} className="gap-1.5">
                    Verder <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* ============= STAP 2: MAPPING ============= */}
          {stap === 'mapping' && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {ruweRijen.length} rijen gevonden. Kies per kolom welk veld het bevat.
                Velden met * zijn verplicht.
              </div>
              <div className="border border-border rounded-md divide-y divide-border">
                {headers.map((header) => {
                  const huidig = mapping[header];
                  const isVerplichtMaarLeeg = huidig === '__skip__';
                  return (
                    <div key={header} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{header}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          Voorbeeld: {ruweRijen[0]?.velden[header] || '—'}
                        </div>
                      </div>
                      <select
                        value={huidig}
                        onChange={(e) => setMapping(m => ({ ...m, [header]: e.target.value as DoelVeld }))}
                        className="h-9 px-2 rounded-md border border-input bg-card text-sm text-foreground min-w-[200px]"
                      >
                        {(Object.keys(VELD_LABELS) as DoelVeld[]).map(v => {
                          const reedsGemapt = v !== '__skip__' && v !== huidig && gemapteVelden.has(v);
                          return (
                            <option key={v} value={v} disabled={reedsGemapt}>
                              {VELD_LABELS[v]}{reedsGemapt ? ' (al gebruikt)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-medium text-foreground">Status verplichte velden:</p>
                <div className="flex flex-wrap gap-1.5">
                  {VERPLICHTE_VELDEN.map(v => {
                    const ok = gemapteVelden.has(v);
                    return (
                      <span
                        key={v}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${
                          ok ? 'bg-success/10 text-success border-success/25' : 'bg-destructive/10 text-destructive border-destructive/25'
                        }`}
                      >
                        {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {VELD_LABELS[v].replace(' *','')}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============= STAP 3: PREVIEW ============= */}
          {stap === 'preview' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">{tellers.totaal} rijen:</span>
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {tellers.valide} valide
                </span>
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> {tellers.dup} duplicate
                </span>
                <span className="inline-flex items-center gap-1 text-destructive">
                  <X className="h-3.5 w-3.5" /> {tellers.fout} ongeldig
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      const sel = new Set(geselecteerd);
                      verwerkt.forEach(v => { if (v.fouten.length === 0 && !v.duplicaatVan) sel.add(v.rijIndex); });
                      setGeselecteerd(sel);
                    }}
                  >Selecteer alle valide</Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      const sel = new Set(geselecteerd);
                      verwerkt.forEach(v => { if (v.duplicaatVan) sel.delete(v.rijIndex); });
                      setGeselecteerd(sel);
                    }}
                  >Deselecteer duplicates</Button>
                </div>
              </div>

              <div className="border border-border rounded-md overflow-x-auto max-h-[calc(85vh-280px)]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-2 py-2 w-8"></th>
                      <th className="text-left px-2 py-2">Status</th>
                      <th className="text-left px-2 py-2">Adres</th>
                      <th className="text-left px-2 py-2">Postcode</th>
                      <th className="text-left px-2 py-2">Plaats</th>
                      <th className="text-left px-2 py-2">Type</th>
                      <th className="text-right px-2 py-2">m²</th>
                      <th className="text-right px-2 py-2">Vraagprijs</th>
                      <th className="text-left px-2 py-2">Issues / Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {verwerkt.map((v) => {
                      const heeftFout = v.fouten.length > 0;
                      const isDup = !!v.duplicaatVan;
                      const checked = geselecteerd.has(v.rijIndex);
                      const rowClass = heeftFout ? 'bg-destructive/5' : isDup ? 'bg-warning/5' : '';
                      return (
                        <tr key={v.rijIndex} className={rowClass}>
                          <td className="px-2 py-2">
                            <Checkbox
                              checked={checked}
                              disabled={heeftFout}
                              onCheckedChange={(c) => {
                                const sel = new Set(geselecteerd);
                                if (c) sel.add(v.rijIndex); else sel.delete(v.rijIndex);
                                setGeselecteerd(sel);
                              }}
                            />
                          </td>
                          <td className="px-2 py-2">
                            {heeftFout ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-destructive/10 text-destructive border border-destructive/25">
                                <X className="h-3 w-3" /> ongeldig
                              </span>
                            ) : isDup ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-warning/10 text-warning border border-warning/25">
                                <AlertTriangle className="h-3 w-3" /> duplicate
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-success/10 text-success border border-success/25">
                                <CheckCircle2 className="h-3 w-3" /> valide
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-foreground">{v.data.adres ?? '—'}</td>
                          <td className="px-2 py-2 font-mono-data">{v.data.postcode ?? '—'}</td>
                          <td className="px-2 py-2">{v.data.plaats ?? '—'}</td>
                          <td className="px-2 py-2">{v.data.assetClass ? ASSET_CLASS_LABELS[v.data.assetClass] : '—'}</td>
                          <td className="px-2 py-2 text-right font-mono-data">{v.data.m2 ?? '—'}</td>
                          <td className="px-2 py-2 text-right font-mono-data">
                            {v.data.vraagprijs != null ? `€${v.data.vraagprijs.toLocaleString('nl-NL')}` : '—'}
                          </td>
                          <td className="px-2 py-2 space-y-1">
                            {v.fouten.map((f, i) => (
                              <div key={i} className="text-destructive">{f}</div>
                            ))}
                            {v.waarschuwingen.map((w, i) => (
                              <div key={i} className="text-warning">⚠ {w}</div>
                            ))}
                            {isDup && !heeftFout && (
                              <label className="inline-flex items-center gap-1.5 text-foreground cursor-pointer">
                                <Checkbox
                                  checked={overschrijven.has(v.rijIndex)}
                                  onCheckedChange={(c) => {
                                    const o = new Set(overschrijven);
                                    if (c) o.add(v.rijIndex); else o.delete(v.rijIndex);
                                    setOverschrijven(o);
                                  }}
                                />
                                Vervang bestaande
                              </label>
                            )}
                            {importFouten.has(v.rijIndex) && (
                              <div className="text-destructive">Import: {importFouten.get(v.rijIndex)}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============= STAP 4: IMPORTEREN ============= */}
          {stap === 'importeren' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="h-10 w-10 text-accent animate-spin" />
              <p className="text-sm font-medium text-foreground">
                Importeren… {voortgang} / {voortgangTotaal}
              </p>
              <div className="w-full max-w-md">
                <Progress value={voortgangTotaal > 0 ? (voortgang / voortgangTotaal) * 100 : 0} />
              </div>
            </div>
          )}
        </div>

        {/* ============= STICKY FOOTER ============= */}
        {stap !== 'importeren' && (
          <div className="border-t border-border px-6 py-3 flex items-center justify-between gap-2 shrink-0 bg-card">
            <div>
              {stap === 'mapping' && (
                <Button variant="ghost" onClick={() => setStap('invoer')} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Terug
                </Button>
              )}
              {stap === 'preview' && (
                <Button variant="ghost" onClick={() => setStap('mapping')} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Terug
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Annuleren</Button>
              {stap === 'mapping' && (
                <Button onClick={naarPreview} className="gap-1.5">
                  Voorbeeld bekijken <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {stap === 'preview' && (
                <Button
                  onClick={startImport}
                  disabled={geselecteerd.size === 0}
                  className="gap-1.5"
                >
                  <Upload className="h-4 w-4" />
                  Importeer {geselecteerd.size} {geselecteerd.size === 1 ? 'rij' : 'rijen'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
