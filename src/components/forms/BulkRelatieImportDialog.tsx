import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/hooks/useDataStore';
import type { Relatie, LeadStatus, PartijType, AssetClass } from '@/data/mock-data';
import { toast } from 'sonner';
import { Upload, Eye, AlertCircle } from 'lucide-react';
import { vindMogelijkeRelaties, zijnDezelfdeInvoer, isGeldigeLinkedinProfielUrl } from '@/lib/relaties/relatieInvoerDubbelen';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ----------------- Header normalisatie + mapping -----------------

type CanonicalField =
  | 'bedrijfsnaam' | 'contactpersoon' | 'type_relatie' | 'type_koper'
  | 'email' | 'telefoonnummer' | 'regio' | 'assetclasses'
  | 'budget_min' | 'budget_max' | 'budget' | 'status'
  | 'first_name' | 'last_name' | 'linkedin' | 'functie' | 'connected_on';

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
registreer('first_name',['First Name','Voornaam']);
registreer('last_name',['Last Name','Achternaam']);
registreer('linkedin',['LinkedIn','LinkedIn URL','LinkedIn-profiel','Profile URL']);
registreer('functie',['Position','Functie','Job title']);
registreer('connected_on',['Connected On','Verbinding sinds','Connected']); 
registreer('email',['Email Address']);

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
  if (!raw) return { status: 'actief' };
  const k = raw.toLowerCase().trim();
  if (STATUS_MAP[k]) return { status: STATUS_MAP[k] };
  return { status: 'actief', waarschuwing: `Onbekende status "${raw}", gebruikt Actief` };
}

// type_relatie -> PartijType (database). koper => belegger, verkoper => eigenaar, etc.
function mapTypeRelatie(raw: string): { type: PartijType; label: string; waarschuwing?: string } {
  const k = raw.toLowerCase().trim();
  if (!k) return { type: 'overig', label: 'Nog te classificeren' };
  if (['koper', 'kopers'].includes(k)) return { type: 'belegger', label: 'Koper' };
  if (['verkoper', 'verkopers'].includes(k)) return { type: 'eigenaar', label: 'Verkoper' };
  if (k === 'partner') return { type: 'partner', label: 'Partner' };
  if (k === 'makelaar') return { type: 'makelaar', label: 'Makelaar' };
  if (k === 'belegger') return { type: 'belegger', label: 'Koper' };
  if (k === 'ontwikkelaar') return { type: 'ontwikkelaar', label: 'Ontwikkelaar' };
  if (k === 'eigenaar') return { type: 'eigenaar', label: 'Eigenaar' };
  return { type: 'overig', label: 'Nog te classificeren', waarschuwing: `Onbekend type "${raw}", gebruikt Overig` };
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
    linkedin: string;
  };
  waarschuwingen: string[];
  fouten: string[];
  overslaan: boolean;
}

export function parseTekst(text: string): { rijen: ParsedRow[]; ontbrekendeHeaders: string[]; herkendeHeaders: { raw: string; veld: CanonicalField | null }[]; isLinkedIn: boolean } {
  // LinkedIn plaatst soms uitlegregels vóór de echte CSV-header. Zoek deze
  // in de eerste 25 regels; een CSV met gewone headers blijft ongewijzigd.
  const regels = text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(r => r.trim().length > 0);
  if (regels.length === 0) return { rijen: [], ontbrekendeHeaders: [], herkendeHeaders: [], isLinkedIn:false };
  const headerIndex=regels.findIndex((line,i)=>i<25 && 
    /\bFirst Name\b/i.test(line)&&/\bLast Name\b/i.test(line)&&/\bURL\b/i.test(line));
  const vanaf=headerIndex>=0?headerIndex:0;
  const sep = detecteerScheider(regels[vanaf]);
  const headerRaw = splitsCsvRegel(regels[vanaf], sep);
  const isLinkedIn=headerIndex>=0;
  const herkendeHeaders = headerRaw.map(h => ({ raw: h,
    veld: isLinkedIn && normaliseerHeader(h)==='url' ? 'linkedin' as CanonicalField : HEADER_MAP[normaliseerHeader(h)] ?? null }));

  // Index per canonical field
  const idx: Partial<Record<CanonicalField, number>> = {};
  herkendeHeaders.forEach((h, i) => { if (h.veld && idx[h.veld] === undefined) idx[h.veld] = i; });

  const ontbrekend: string[] = [];
  if (idx.bedrijfsnaam === undefined && idx.contactpersoon === undefined &&
      (idx.first_name === undefined || idx.last_name === undefined)) {
    ontbrekend.push('Bedrijfsnaam, Contactpersoon of Voornaam/Achternaam');
  }

  const rijen: ParsedRow[] = [];
  for (let r = vanaf+1; r < regels.length; r++) {
    const velden = splitsCsvRegel(regels[r], sep);
    const get = (v?: number) => (v === undefined ? '' : (velden[v] ?? '').trim());

    const bedrijf = get(idx.bedrijfsnaam);
    const contact = get(idx.contactpersoon)||
      [get(idx.first_name),get(idx.last_name)].filter(Boolean).join(' ').trim();
    const typeRelatieRaw = get(idx.type_relatie);
    const typeKoperRaw = get(idx.type_koper);
    const emailRaw = get(idx.email);
    const telefoon = get(idx.telefoonnummer);
    const linkedin=get(idx.linkedin);
    const functie=get(idx.functie);
    const verbondenSinds=get(idx.connected_on);
    const regio = splitsLijst(get(idx.regio));
    const assets = splitsLijst(get(idx.assetclasses)) as AssetClass[];
    const statusRaw = get(idx.status);

    const waarschuwingen: string[] = [];
    const fouten: string[] = [];

    // Email
    const email = emailRaw.toLowerCase();
    if (email && !geldigEmail(email)) fouten.push('Ongeldig e-mailadres');
    if(linkedin&&!isGeldigeLinkedinProfielUrl(linkedin))
      fouten.push('Ongeldige LinkedIn-profiel-URL');

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

    // Export bevat een netwerk, niet per definitie kopers of beleggers.
    const tr = isLinkedIn&&!typeRelatieRaw ?
      {type:'overig' as PartijType,label:'Nog te classificeren'} :
      mapTypeRelatie(typeRelatieRaw);
    if (tr.waarschuwing) waarschuwingen.push(tr.waarschuwing);
    const tk = mapTypeKoper(typeKoperRaw);
    if (tk.waarschuwing) waarschuwingen.push(tk.waarschuwing);
    const st = mapStatus(statusRaw);
    if (st.waarschuwing) waarschuwingen.push(st.waarschuwing);

    const overslaan = !bedrijf && !contact;

    const displayBedrijf = bedrijf || contact || '—';
    const metadata = [
      isLinkedIn?'LinkedIn-connectie (niet automatisch gekwalificeerd)':null,
      functie?`Functie (bij export): ${functie}`:null,
      verbondenSinds?`Connectie sinds: ${verbondenSinds}`:null,
      typeKoperRaw?`Type koper: ${tk.label}`:null,
    ].filter(Boolean).join('\n');

    const data: Partial<Relatie> = {
      bedrijfsnaam: bedrijf || contact || '',
      contactpersoon: contact,
      type: tr.type,
      telefoon,
      email,
      linkedinUrl:linkedin||undefined,
      bronRelatie:isLinkedIn?'LinkedIn-connectie-export (handmatig geselecteerd)':'Handmatige lijstimport',
      regio,
      assetClasses: assets,
      budgetMin,
      budgetMax,
      leadStatus: st.status,
      // type_koper info bewaren in notities (geen apart DB-veld voor dit label)
      notities:metadata||undefined,
    };

    rijen.push({
      rijIndex: r-vanaf,
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
        linkedin,
      },
      waarschuwingen,
      fouten,
      overslaan,
    });
  }

  return { rijen, ontbrekendeHeaders: ontbrekend, herkendeHeaders,isLinkedIn };
}

// ----------------- Component -----------------

export default function BulkRelatieImportDialog({ open, onOpenChange }: Props) {
  const { bulkInsertRelaties, relaties, contactpersonen } = useDataStore();
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  const [preview, setPreview] = useState(false);
  const [geselecteerd,setGeselecteerd] = useState<number[]>([]);

  const parseResult = useMemo(() => preview ? parseTekst(tekst) :
    { rijen: [] as ParsedRow[], ontbrekendeHeaders: [] as string[],
      herkendeHeaders: [] as {raw:string;veld:CanonicalField|null}[],isLinkedIn:false },
    [tekst,preview]);
  const { rijen, ontbrekendeHeaders, herkendeHeaders,isLinkedIn } = parseResult;
  const dubbelRedenen=useMemo(()=>{
    const result=new Map<number,string>();
    const eerder:ParsedRow[]=[];
    for(const rij of rijen){
      if(rij.overslaan){eerder.push(rij);continue;}
      const bestaande=vindMogelijkeRelaties(rij.data,relaties,contactpersonen??[]);
      if(bestaande.length>0){
        result.set(rij.rijIndex,`Bestaande relatie: ${bestaande.map(x=>x.relatie.bedrijfsnaam).slice(0,2).join(', ')} (${bestaande[0].redenen.join(', ')})`);
      }
      const vorige=eerder.find(x=>!x.overslaan&&zijnDezelfdeInvoer(x.data,rij.data));
      if(vorige)result.set(rij.rijIndex,`Dubbel binnen import: rij ${vorige.rijIndex}`);
      eerder.push(rij);
    }
    return result;
  },[rijen,relaties,contactpersonen]);
  const veilig=(r:ParsedRow)=> !r.overslaan&&r.fouten.length===0&&!dubbelRedenen.has(r.rijIndex);
  // LinkedIn-connecties zijn geen gekwalificeerde prospects; aanvankelijk
  // dus niemand geselecteerd. Bij gewone CSV mogen veilige rijen standaard mee.
  useEffect(()=>{
    if(!preview){setGeselecteerd([]);return;}
    setGeselecteerd(isLinkedIn?[]:rijen.filter(veilig).map(r=>r.rijIndex));
    // De selectie reset alleen wanneer een nieuwe inhoud/preview geladen wordt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[preview,tekst]);
  const teImporteren = rijen.filter(r=>veilig(r)&&geselecteerd.includes(r.rijIndex));
  const beschikbaar=rijen.filter(veilig);
  const overgeslagen = rijen.filter(r=>r.overslaan).length;
  const metFouten = rijen.filter(r=>!r.overslaan&&r.fouten.length>0).length;
  const dubbeled = dubbelRedenen.size;

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
      // Hercontrole rechtstreeks in Supabase. Zo wordt geen verouderde
      // voorvertoning opgeslagen nadat elders een contact is toegevoegd.
      const [liveRelaties,liveContacten]=await Promise.all([
        supabase.from('relaties').select('id,bedrijfsnaam,contactpersoon,email,telefoon,linkedin_url,soft_deleted_at')
          .is('soft_deleted_at',null),
        supabase.from('relatie_contactpersonen').select('relatie_id,naam,email,telefoon,telefoon_mobiel,linkedin_url'),
      ]);
      if(liveRelaties.error||liveContacten.error)throw new Error('Bestaande relaties konden niet opnieuw gecontroleerd worden.');
      const actuele=(liveRelaties.data??[]).map(r=>({
        id:r.id,bedrijfsnaam:r.bedrijfsnaam??'',contactpersoon:r.contactpersoon??'',
        email:r.email??'',telefoon:r.telefoon??'',linkedinUrl:r.linkedin_url??'',
      })) as Relatie[];
      const contactkaart=(liveContacten.data??[]).map(c=>({
        relatieId:c.relatie_id,naam:c.naam??'',email:c.email??'',
        telefoon:c.telefoon??'',telefoonMobiel:c.telefoon_mobiel??'',
        linkedinUrl:c.linkedin_url??'',
      })) as import('@/data/mock-data').RelatieContactpersoon[];
      const nieuweDubbel=teImporteren.filter(r=>
        vindMogelijkeRelaties(r.data,actuele,contactkaart).length>0);
      if(nieuweDubbel.length>0)throw new Error(`${nieuweDubbel.length} gekozen rij(en) komen intussen al in het CRM voor. Ververs de import en controleer de dubbelen.`);
      const { ok, fout, contactenFout } = await bulkInsertRelaties(teImporteren.map(r => r.data));
      if (ok > 0) toast.success(`${ok} relatie(s) geïmporteerd`);
      if (fout > 0) toast.error(`${fout} rij(en) niet opgeslagen`);
      if (contactenFout > 0) toast.error(`${contactenFout} primaire contactpersoon/-personen niet opgeslagen; relaties bestaan al. Niet opnieuw importeren.`);
      if (ok > 0) {
        setTekst(''); setPreview(false);setGeselecteerd([]); onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(`Import mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const reset = () => { setTekst(''); setPreview(false);setGeselecteerd([]); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meerdere relaties toevoegen</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Header-gebaseerde import</p>
              <p>CSV en rechtstreeks plakken uit Excel worden ondersteund. Ook een uitgepakte LinkedIn-<code>Connections.csv</code> kan hier worden ingelezen. Kies daarna zelf welke connecties je als relatie wilt vastleggen.</p>
              <p>Bij een LinkedIn-export wordt niemand automatisch geselecteerd en wordt het partijtype niet als belegger verondersteld.</p>
              <p>Herkende kolomnamen (varianten en accenten worden automatisch herkend):</p>
              <p className="font-mono text-[11px] leading-relaxed break-words">
                Bedrijfsnaam · Contactpersoon · Voornaam · Achternaam · Type relatie · Type koper · E-mail · Telefoon · LinkedIn-URL · Functie · Regio · Assetclasses · Budget · Status
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
                <Upload className="h-4 w-4" /> CSV of LinkedIn-export uploaden
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
              <p className="font-medium text-foreground mb-1.5">
                {isLinkedIn?'LinkedIn-connectie-export herkend':'Herkende kolommen'}
              </p>
              {isLinkedIn&&<p className="mb-2 text-muted-foreground">
                Je selecteert handmatig wie relevant is. Alle contacten krijgen eerst type
                ‘Nog te classificeren’ en standaard leadstatus ‘Actief’.
              </p>}
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
                <span className="text-success">{teImporteren.length} geselecteerd</span>
                <span>{beschikbaar.length} zonder gevonden dubbel</span>
                {dubbeled>0&&<span className="text-amber-600">{dubbeled} mogelijk dubbel</span>}
                {metFouten > 0 && <span className="text-destructive">{metFouten} met fouten</span>}
                {overgeslagen > 0 && <span>{overgeslagen} overgeslagen (leeg)</span>}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button size="sm" type="button" variant="outline"
                onClick={()=>setGeselecteerd(beschikbaar.map(r=>r.rijIndex))}
                disabled={beschikbaar.length===0}>Selecteer veilige rijen</Button>
              <Button size="sm" type="button" variant="ghost"
                onClick={()=>setGeselecteerd([])}>Selectie wissen</Button>
              <span className="text-muted-foreground">Mogelijke dubbelen en rijen met fouten zijn niet selecteerbaar.</span>
            </div>
            <div className="border border-border rounded-md overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-2">Kies</th>
                    <th className="text-left px-2 py-2">#</th>
                    <th className="text-left px-2 py-2">Bedrijf</th>
                    <th className="text-left px-2 py-2">Contactpersoon</th>
                    <th className="text-left px-2 py-2">Type relatie</th>
                    <th className="text-left px-2 py-2">Type koper</th>
                    <th className="text-left px-2 py-2">E-mail</th>
                    <th className="text-left px-2 py-2">LinkedIn</th>
                    <th className="text-left px-2 py-2">Telefoon</th>
                    <th className="text-left px-2 py-2">Budget min</th>
                    <th className="text-left px-2 py-2">Budget max</th>
                    <th className="text-left px-2 py-2">Status</th>
                    <th className="text-left px-2 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rijen.map((r) => {
                    const conflict=dubbelRedenen.get(r.rijIndex);
                    const klasse = r.overslaan
                      ? 'bg-muted/30 text-muted-foreground'
                      : r.fouten.length > 0 ? 'bg-destructive/5'
                      : r.waarschuwingen.length > 0 ? 'bg-warning/5' : '';
                    return (
                      <tr key={r.rijIndex} className={klasse}>
                        <td className="px-2 py-2">
                          <input type="checkbox" aria-label={`Selecteer ${r.preview.contactpersoon||r.preview.bedrijf}`}
                            checked={geselecteerd.includes(r.rijIndex)&&veilig(r)}
                            disabled={!veilig(r)||bezig}
                            onChange={e=>setGeselecteerd(current=>e.target.checked?
                              [...current,r.rijIndex]:current.filter(x=>x!==r.rijIndex))}/>
                        </td>
                        <td className="px-2 py-2 tabular-nums">{r.rijIndex}</td>
                        <td className="px-2 py-2 font-medium">{r.preview.bedrijf}</td>
                        <td className="px-2 py-2">{r.preview.contactpersoon || '—'}</td>
                        <td className="px-2 py-2">{r.preview.typeRelatieLabel}</td>
                        <td className="px-2 py-2">{r.preview.typeKoperLabel}</td>
                        <td className="px-2 py-2">{r.preview.email || '—'}</td>
                        <td className="px-2 py-2 max-w-[190px] truncate">{r.preview.linkedin || '—'}</td>
                        <td className="px-2 py-2">{r.preview.telefoon || '—'}</td>
                        <td className="px-2 py-2 tabular-nums">{r.preview.budgetMin?.toLocaleString('nl-NL') ?? '—'}</td>
                        <td className="px-2 py-2 tabular-nums">{r.preview.budgetMax?.toLocaleString('nl-NL') ?? '—'}</td>
                        <td className="px-2 py-2">{r.preview.statusLabel}</td>
                        <td className="px-2 py-2">
                          {r.overslaan ? (
                            <span className="text-muted-foreground">Overgeslagen — bedrijf én contactpersoon leeg</span>
                          ) : conflict ? (
                            <span className="text-amber-600">{conflict}</span>
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
                {bezig ? 'Bezig…' : `Importeer ${teImporteren.length} geselecteerde relatie(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
