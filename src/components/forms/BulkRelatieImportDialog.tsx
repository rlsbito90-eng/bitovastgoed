import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/hooks/useDataStore';
import type { Relatie, LeadStatus, PartijType, AssetClass } from '@/data/mock-data';
import { toast } from 'sonner';
import { Upload, Eye, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ----------------- Header normalisatie + mapping -----------------

type CanonicalField =
  | 'bedrijfsnaam' | 'contactpersoon' | 'type_relatie' | 'type_koper'
  | 'email' | 'telefoonnummer' | 'regio' | 'assetclasses'
  | 'budget_min' | 'budget_max' | 'budget' | 'status';

function normaliseerHeader(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accenten weg
    .replace(/['’`]/g, '')
    .replace(/[\s\-_]+/g, '')
    .trim();
}

// normalised header => canonical field
const HEADER_MAP: Record<string, CanonicalField> = {};
const registreer = (veld: CanonicalField, varianten: string[]) => {
  varianten.forEach(v => { HEADER_MAP[normaliseerHeader(v)] = veld; });
};
registreer('bedrijfsnaam', ['Bedrijf', 'Bedrijfsnaam', 'Company', 'Organisatie', 'Bedrijfsnaam relatie']);
registreer('contactpersoon', ['Contact', 'Contactpersoon', 'Naam', 'Volledige naam', 'Persoon', 'Contact naam', 'Naam contactpersoon']);
registreer('type_relatie', ['Type', 'Type relatie', 'Relatietype', 'Relatie type']);
registreer('type_koper', ['Type koper', 'Koperstype', 'Soort koper']);
registreer('email', ['E-mail', 'Email', 'E-mailadres', 'Mail', 'Emailadres']);
registreer('telefoonnummer', ['Telefoon', 'Telefoonnummer', 'Mobiel', 'Phone', 'Tel']);
registreer('regio', ['Regio', "Regio's", 'Regios', 'Gebied', 'Werkgebied']);
registreer('assetclasses', ['Assetclasses', 'Asset classes', 'Vastgoedtype', 'Vastgoedtypes', 'Objecttypes', 'Asset class']);
registreer('budget_min', ['Budget Min', 'Budget minimum', 'Min budget', 'Budget vanaf']);
registreer('budget_max', ['Budget Max', 'Budget maximum', 'Max budget', 'Budget tot']);
registreer('budget', ['Budget']);
registreer('status', ['Status', 'Leadstatus', 'Lead status', 'LeadSatus']);

// ----------------- Splitsing -----------------

function detecteerScheider(eersteRegel: string): ',' | ';' | '\t' {
  if (eersteRegel.includes('\t')) return '\t';
  // Kies tussen ; en , gebaseerd op aantal voorkomens
  const puntkomma = (eersteRegel.match(/;/g) || []).length;
  const komma = (eersteRegel.match(/,/g) || []).length;
  return puntkomma > komma ? ';' : ',';
}

function splitsCsvRegel(regel: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < regel.length; i++) {
    const c = regel[i];
    if (inQuote) {
      if (c === '"' && regel[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// ----------------- Waarde-helpers -----------------

function parseBudget(raw: string): number | undefined {
  if (!raw) return undefined;
  // Behoud alleen cijfers — verwijder €, punten, komma's, spaties, alles
  const schoon = raw.replace(/[^\d]/g, '');
  if (!schoon) return undefined;
  const n = Number(schoon);
  return Number.isFinite(n) ? n : undefined;
}

function parseBudgetRange(raw: string): { min?: number; max?: number } {
  if (!raw) return {};
  // Probeer een range "X - Y" of "X tot Y"
  const m = raw.match(/(\d[\d.,\s€]*)\s*(?:-|–|tot|t\/m|\/)\s*(\d[\d.,\s€]*)/i);
  if (m) {
    return { min: parseBudget(m[1]), max: parseBudget(m[2]) };
  }
  // Eén waarde — interpreteer als max (of beide leeg)
  const enkel = parseBudget(raw);
  return enkel ? { max: enkel } : {};
}

function splitsLijst(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
}

const STATUS_MAP: Record<string, LeadStatus> = {
  actief: 'actief', warm: 'warm', lauw: 'lauw', koud: 'koud',
};

function mapStatus(raw: string): { status: LeadStatus; waarschuwing?: string } {
  if (!raw) return { status: 'lauw' };
  const k = raw.toLowerCase().trim();
  if (STATUS_MAP[k]) return { status: STATUS_MAP[k] };
  return { status: 'lauw', waarschuwing: `Onbekende status "${raw}", gebruikt Lauw` };
}

// type_relatie -> PartijType (database). koper => belegger, verkoper => eigenaar, etc.
function mapTypeRelatie(raw: string): { type: PartijType; label: string; waarschuwing?: string } {
  const k = raw.toLowerCase().trim();
  if (!k) return { type: 'belegger', label: 'Koper' };
  if (['koper', 'kopers'].includes(k)) return { type: 'belegger', label: 'Koper' };
  if (['verkoper', 'verkopers'].includes(k)) return { type: 'eigenaar', label: 'Verkoper' };
  if (k === 'partner') return { type: 'partner', label: 'Partner' };
  if (k === 'makelaar') return { type: 'makelaar', label: 'Makelaar' };
  if (k === 'belegger') return { type: 'belegger', label: 'Koper' };
  if (k === 'ontwikkelaar') return { type: 'ontwikkelaar', label: 'Ontwikkelaar' };
  if (k === 'eigenaar') return { type: 'eigenaar', label: 'Eigenaar' };
  return { type: 'belegger', label: raw, waarschuwing: `Onbekend type "${raw}", gebruikt Koper` };
}

function mapTypeKoper(raw: string): { label: string; waarschuwing?: string } {
  const k = raw.toLowerCase().trim();
  if (!k) return { label: 'Belegger' };
  if (k.includes('professionele') && k.includes('belegger')) return { label: 'Belegger' };
  if (k === 'belegger') return { label: 'Belegger' };
  if (k === 'ontwikkelaar') return { label: 'Ontwikkelaar' };
  if (k === 'eindgebruiker') return { label: 'Eindgebruiker' };
  if (k === 'vastgoedadviseur') return { label: 'Vastgoedadviseur' };
  return { label: 'Belegger', waarschuwing: `Onbekend type koper "${raw}", gebruikt Belegger` };
}

function geldigEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ----------------- Parsing -----------------

interface ParsedRow {
  rijIndex: number;
  data: Partial<Relatie>;
  preview: {
    bedrijf: string;
    contactpersoon: string;
    typeRelatieLabel: string;
    typeKoperLabel: string;
    email: string;
    telefoon: string;
    budgetMin?: number;
    budgetMax?: number;
    statusLabel: string;
  };
  waarschuwingen: string[];
  fouten: string[];
  overslaan: boolean;
}

function parseTekst(text: string): { rijen: ParsedRow[]; ontbrekendeHeaders: string[]; herkendeHeaders: { raw: string; veld: CanonicalField | null }[] } {
  const regels = text.split(/\r?\n/).filter(r => r.trim().length > 0);
  if (regels.length === 0) return { rijen: [], ontbrekendeHeaders: [], herkendeHeaders: [] };

  const sep = detecteerScheider(regels[0]);
  const headerRaw = splitsCsvRegel(regels[0], sep);
  const herkendeHeaders = headerRaw.map(h => ({ raw: h, veld: HEADER_MAP[normaliseerHeader(h)] ?? null }));

  // Index per canonical field
  const idx: Partial<Record<CanonicalField, number>> = {};
  herkendeHeaders.forEach((h, i) => { if (h.veld && idx[h.veld] === undefined) idx[h.veld] = i; });

  const ontbrekend: string[] = [];
  if (idx.bedrijfsnaam === undefined && idx.contactpersoon === undefined) {
    ontbrekend.push('Bedrijfsnaam of Contactpersoon');
  }

  const rijen: ParsedRow[] = [];
  for (let r = 1; r < regels.length; r++) {
    const velden = splitsCsvRegel(regels[r], sep);
    const get = (v?: number) => (v === undefined ? '' : (velden[v] ?? '').trim());

    const bedrijf = get(idx.bedrijfsnaam);
    const contact = get(idx.contactpersoon);
    const typeRelatieRaw = get(idx.type_relatie);
    const typeKoperRaw = get(idx.type_koper);
    const emailRaw = get(idx.email);
    const telefoon = get(idx.telefoonnummer);
    const regio = splitsLijst(get(idx.regio));
    const assets = splitsLijst(get(idx.assetclasses)) as AssetClass[];
    const statusRaw = get(idx.status);

    const waarschuwingen: string[] = [];
    const fouten: string[] = [];

    // Email
    const email = emailRaw.toLowerCase();
    if (email && !geldigEmail(email)) fouten.push('Ongeldig e-mailadres');

    // Budget
    let budgetMin = parseBudget(get(idx.budget_min));
    let budgetMax = parseBudget(get(idx.budget_max));
    if (budgetMin === undefined && budgetMax === undefined && idx.budget !== undefined) {
      const r = parseBudgetRange(get(idx.budget));
      budgetMin = r.min; budgetMax = r.max;
    }
    if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) {
      waarschuwingen.push('Budget min > max');
    }

    const tr = mapTypeRelatie(typeRelatieRaw);
    if (tr.waarschuwing) waarschuwingen.push(tr.waarschuwing);
    const tk = mapTypeKoper(typeKoperRaw);
    if (tk.waarschuwing) waarschuwingen.push(tk.waarschuwing);
    const st = mapStatus(statusRaw);
    if (st.waarschuwing) waarschuwingen.push(st.waarschuwing);

    const overslaan = !bedrijf && !contact;

    const displayBedrijf = bedrijf || contact || '—';

    const data: Partial<Relatie> = {
      bedrijfsnaam: bedrijf || contact || '',
      contactpersoon: contact,
      type: tr.type,
      telefoon,
      email,
      regio,
      assetClasses: assets,
      budgetMin,
      budgetMax,
      leadStatus: st.status,
      // type_koper info bewaren in notities (geen apart DB-veld voor dit label)
      notities: typeKoperRaw ? `Type koper: ${tk.label}` : undefined,
    };

    rijen.push({
      rijIndex: r,
      data,
      preview: {
        bedrijf: displayBedrijf,
        contactpersoon: contact,
        typeRelatieLabel: tr.label,
        typeKoperLabel: typeKoperRaw ? tk.label : '—',
        email: email || '',
        telefoon,
        budgetMin,
        budgetMax,
        statusLabel: st.status.charAt(0).toUpperCase() + st.status.slice(1),
      },
      waarschuwingen,
      fouten,
      overslaan,
    });
  }

  return { rijen, ontbrekendeHeaders: ontbrekend, herkendeHeaders };
}

// ----------------- Component -----------------

export default function BulkRelatieImportDialog({ open, onOpenChange }: Props) {
  const { bulkInsertRelaties } = useDataStore();
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  const [preview, setPreview] = useState(false);

  const parseResult = useMemo(() => (preview ? parseTekst(tekst) : { rijen: [], ontbrekendeHeaders: [], herkendeHeaders: [] }), [tekst, preview]);
  const { rijen, ontbrekendeHeaders, herkendeHeaders } = parseResult;
  const teImporteren = rijen.filter(r => !r.overslaan && r.fouten.length === 0);
  const overgeslagen = rijen.filter(r => r.overslaan).length;
  const metFouten = rijen.filter(r => !r.overslaan && r.fouten.length > 0).length;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setTekst((e.target?.result as string) || '');
      setPreview(true);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (teImporteren.length === 0) {
      toast.error('Geen geldige rijen om te importeren');
      return;
    }
    setBezig(true);
    try {
      const { ok, fout } = await bulkInsertRelaties(teImporteren.map(r => r.data));
      if (ok > 0) toast.success(`${ok} relatie(s) geïmporteerd`);
      if (fout > 0) toast.error(`${fout} rij(en) niet opgeslagen`);
      if (ok > 0) {
        setTekst(''); setPreview(false); onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(`Import mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const reset = () => { setTekst(''); setPreview(false); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relaties bulk importeren</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Header-gebaseerde import</p>
              <p>De eerste rij wordt gelezen als header. Kolomvolgorde maakt niet uit. Ondersteunde scheidingstekens: komma, puntkomma of tab (Excel-paste).</p>
              <p>Herkende kolomnamen (varianten en accenten worden automatisch herkend):</p>
              <p className="font-mono text-[11px] leading-relaxed break-words">
                Bedrijfsnaam · Contactpersoon · Type relatie · Type koper · E-mail · Telefoonnummer · Regio · Assetclasses · Budget Min · Budget Max · Budget · Status
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Plak CSV of tabelgegevens</Label>
              <Textarea
                value={tekst}
                onChange={e => setTekst(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder={'Bedrijfsnaam,Contactpersoon,Type relatie,Type koper,E-mail,Telefoon,Regio,Assetclasses,Budget Min,Budget Max,Status\nVoorbeeld B.V.,Test Persoon,Koper,Belegger,naam@voorbeeld.nl,06 0000 0000,Randstad,"wonen,logistiek",1000000,5000000,Warm'}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-sm border border-border rounded-md hover:bg-muted cursor-pointer">
                <Upload className="h-4 w-4" /> CSV uploaden
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              <Button type="button" onClick={() => setPreview(true)} disabled={!tekst.trim()} className="ml-auto">
                <Eye className="h-4 w-4 mr-1.5" /> Voorbeeld bekijken
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header herkenning */}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground mb-1.5">Herkende kolommen</p>
              <div className="flex flex-wrap gap-1.5">
                {herkendeHeaders.map((h, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded border ${h.veld ? 'border-success/40 bg-success/10 text-success' : 'border-muted-foreground/20 text-muted-foreground'}`}>
                    {h.raw}{h.veld ? ` → ${h.veld}` : ' (genegeerd)'}
                  </span>
                ))}
              </div>
              {ontbrekendeHeaders.length > 0 && (
                <p className="mt-2 text-destructive">Vereist ontbreekt: {ontbrekendeHeaders.join(', ')}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">{rijen.length} rij(en) gedetecteerd</span>
              <span className="text-muted-foreground space-x-3">
                <span className="text-success">{teImporteren.length} importeerbaar</span>
                {metFouten > 0 && <span className="text-destructive">{metFouten} met fouten</span>}
                {overgeslagen > 0 && <span>{overgeslagen} overgeslagen (leeg)</span>}
              </span>
            </div>

            <div className="border border-border rounded-md overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-2">#</th>
                    <th className="text-left px-2 py-2">Bedrijf</th>
                    <th className="text-left px-2 py-2">Contactpersoon</th>
                    <th className="text-left px-2 py-2">Type relatie</th>
                    <th className="text-left px-2 py-2">Type koper</th>
                    <th className="text-left px-2 py-2">E-mail</th>
                    <th className="text-left px-2 py-2">Telefoon</th>
                    <th className="text-left px-2 py-2">Budget min</th>
                    <th className="text-left px-2 py-2">Budget max</th>
                    <th className="text-left px-2 py-2">Status</th>
                    <th className="text-left px-2 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rijen.map((r) => {
                    const klasse = r.overslaan
                      ? 'bg-muted/30 text-muted-foreground'
                      : r.fouten.length > 0 ? 'bg-destructive/5'
                      : r.waarschuwingen.length > 0 ? 'bg-warning/5' : '';
                    return (
                      <tr key={r.rijIndex} className={klasse}>
                        <td className="px-2 py-2 tabular-nums">{r.rijIndex}</td>
                        <td className="px-2 py-2 font-medium">{r.preview.bedrijf}</td>
                        <td className="px-2 py-2">{r.preview.contactpersoon || '—'}</td>
                        <td className="px-2 py-2">{r.preview.typeRelatieLabel}</td>
                        <td className="px-2 py-2">{r.preview.typeKoperLabel}</td>
                        <td className="px-2 py-2">{r.preview.email || '—'}</td>
                        <td className="px-2 py-2">{r.preview.telefoon || '—'}</td>
                        <td className="px-2 py-2 tabular-nums">{r.preview.budgetMin?.toLocaleString('nl-NL') ?? '—'}</td>
                        <td className="px-2 py-2 tabular-nums">{r.preview.budgetMax?.toLocaleString('nl-NL') ?? '—'}</td>
                        <td className="px-2 py-2">{r.preview.statusLabel}</td>
                        <td className="px-2 py-2">
                          {r.overslaan ? (
                            <span className="text-muted-foreground">Overgeslagen — bedrijf én contactpersoon leeg</span>
                          ) : r.fouten.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-3 w-3" /> {r.fouten.join(', ')}
                            </span>
                          ) : r.waarschuwingen.length > 0 ? (
                            <span className="text-warning">{r.waarschuwingen.join(', ')}</span>
                          ) : (
                            <span className="text-success">ok</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPreview(false)}>Terug</Button>
              <Button type="button" onClick={handleImport} disabled={bezig || teImporteren.length === 0 || ontbrekendeHeaders.length > 0}>
                {bezig ? 'Bezig…' : `Importeer ${teImporteren.length} relatie(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
