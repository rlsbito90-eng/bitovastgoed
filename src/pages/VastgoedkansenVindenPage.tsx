import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Database, Loader2, MapPin, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignalenAlle } from '@/hooks/useOffMarketSignalen';
import { zoekBagKandidatenMetStatistiek, type BagKandidaat, type BagSelectieStatistiek } from '@/lib/pdokBagSelectie';
import BagServicePandenlijst from '@/components/bag/BagServicePandenlijst';
import { maakHandmatigeBagKans, type BagPromotieResultaat } from '@/lib/bag/handmatigePromotie';
import type { BagVerkennerPand } from '@/lib/bag/pandenverkennerModel';
import {
  BAG_STANDAARD_ACTIEVE_SCOPECODES,
  bepaalActieveBagScopes,
  bepaalVoorkeursBagScope,
} from '@/lib/bag/scopeRegistry';

const BAG_SERVICE_ENABLED = import.meta.env.VITE_BAG_QUERY_SERVICE_ENABLED === 'true';
const BAG_SERVICE_SCOPE = bepaalVoorkeursBagScope(
  bepaalActieveBagScopes(
    import.meta.env.VITE_BAG_QUERY_ALLOWED_SCOPES || BAG_STANDAARD_ACTIEVE_SCOPECODES,
  ),
)?.code || '0363';

const GEBRUIKSDOELEN = [
  ['kantoorfunctie', 'Kantoor'],
  ['industriefunctie', 'Bedrijfsruimte / industrie'],
  ['winkelfunctie', 'Winkel'],
  ['bijeenkomstfunctie', 'Bijeenkomst / horeca'],
  ['gezondheidszorgfunctie', 'Zorg'],
  ['logiesfunctie', 'Hotel / logies'],
  ['onderwijsfunctie', 'Onderwijs'],
  ['sportfunctie', 'Sport'],
  ['overige gebruiksfunctie', 'Overig'],
] as const;

function norm(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function foutmelding(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function VastgoedkansenVindenPage() {
  const { kansen, addKans } = useVastgoedkansen();
  const { data: signalen = [] } = useOffMarketSignalenAlle();
  const { objecten } = useDataStore();
  const objectRefs = useMemo(() => objecten as Array<(typeof objecten)[number] & {
      bagPandId?: string;
      straatAdres?: string;
    }>, [objecten]);
  const [gemeente, setGemeente] = useState('Amsterdam');
  const [bouwjaarVan, setBouwjaarVan] = useState('');
  const [bouwjaarTot, setBouwjaarTot] = useState('1995');
  const [limiet, setLimiet] = useState('30');
  const [gebruiksdoelen, setGebruiksdoelen] = useState<string[]>(['kantoorfunctie', 'industriefunctie', 'winkelfunctie']);
  const [resultaten, setResultaten] = useState<BagKandidaat[]>([]);
  const [statistiek, setStatistiek] = useState<BagSelectieStatistiek | null>(null);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [zoeken, setZoeken] = useState(false);
  const [opslaan, setOpslaan] = useState(false);

  const bestaandeBagIds = useMemo(() => new Set([
    ...kansen.map(k => k.bagPandId),
    ...objectRefs.map(o => o.bagPandId),
  ].filter((value): value is string => Boolean(value))), [kansen, objectRefs]);
  const bestaandeAdressen = useMemo(() => new Set([
    ...kansen.map(k => norm(`${k.adres}|${k.postcode}`)),
    ...objectRefs.map(o => norm(`${o.adres ?? o.straatAdres ?? ''}|${o.postcode ?? ''}`)),
    ...signalen.map(s => norm(`${s.adres ?? ''}|${s.postcode ?? ''}`)),
  ].filter(Boolean)), [kansen, objectRefs, signalen]);

  const toggleDoel = (doel: string) => setGebruiksdoelen(prev => prev.includes(doel) ? prev.filter(x => x !== doel) : [...prev, doel]);
  const isBestaand = (k: BagKandidaat) => bestaandeBagIds.has(k.bagPandId) || bestaandeAdressen.has(norm(`${k.adres}|${k.postcode}`));
  const promoveerPrivateBagPanden = async (panden: BagVerkennerPand[]): Promise<BagPromotieResultaat> => {
    const resultaat: BagPromotieResultaat = { toegevoegd: [], mislukt: [] };
    for (const pand of panden) {
      try {
        await addKans(maakHandmatigeBagKans(pand, BAG_SERVICE_SCOPE));
        resultaat.toegevoegd.push(pand.bagPandId);
      } catch {
        resultaat.mislukt.push(pand.bagPandId);
      }
    }
    return resultaat;
  };

  const run = async () => {
    if (!gemeente.trim()) { toast.error('Vul een gemeente in.'); return; }
    setZoeken(true);
    setGeselecteerd(new Set());
    setStatistiek(null);
    try {
      const result = await zoekBagKandidatenMetStatistiek({
        gemeente: gemeente.trim(),
        bouwjaarVan: bouwjaarVan ? Number(bouwjaarVan) : null,
        bouwjaarTot: bouwjaarTot ? Number(bouwjaarTot) : null,
        gebruiksdoelen,
        limiet: Math.min(Math.max(Number(limiet) || 30, 5), 100),
      });
      setResultaten(result.kandidaten);
      setStatistiek(result.statistiek);
      toast.success(`${result.kandidaten.length} kandidaatpanden binnen gemeente ${gemeente.trim()} gevonden.`);
    } catch (error: unknown) {
      toast.error(foutmelding(error, 'PDOK-selectie mislukt.'));
    } finally { setZoeken(false); }
  };

  const save = async () => {
    const items = resultaten.filter(item => geselecteerd.has(item.bagPandId) && !isBestaand(item));
    if (!items.length) { toast.error('Selecteer minimaal één nieuw kandidaatpand.'); return; }
    setOpslaan(true);
    try {
      for (const item of items) {
        await addKans({
          adres: item.adres,
          postcode: item.postcode ?? undefined,
          plaats: item.plaats ?? gemeente,
          typeVastgoed: item.gebruiksdoel ?? undefined,
          korteOmschrijving: item.gebruiksdoel ? `${item.gebruiksdoel} — ${item.adres}` : item.adres,
          herkomst: 'bag_selectie',
          herkomstReferentie: `PDOK BAG selectie ${gemeente}`,
          bagPandId: item.bagPandId,
          bagVerblijfsobjectId: item.bagVerblijfsobjectId ?? undefined,
          redenInteressant: `Gevonden via BAG-selectie: gemeente ${gemeente}${bouwjaarTot ? `, bouwjaar t/m ${bouwjaarTot}` : ''}.`,
          status: 'te_beoordelen',
          prioriteit: 3,
        });
      }
      toast.success(`${items.length} panden toegevoegd aan Vastgoedkansen.`);
      setGeselecteerd(new Set());
    } catch (error: unknown) {
      toast.error(foutmelding(error, 'Toevoegen aan Vastgoedkansen mislukt.'));
    } finally { setOpslaan(false); }
  };

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <Link to="/vastgoedkansen" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1.5 h-4 w-4"/>Vastgoedkansen</Link>
    <PageHeader title="Pandenverkenner" subtitle={BAG_SERVICE_ENABLED
      ? 'Verken de actieve private BAG-dataset en controleer kandidaten vóór handmatige toevoeging.'
      : 'Gecontroleerde selectie uit de officiële BAG via PDOK, begrensd op de gekozen gemeente.'} />

    {BAG_SERVICE_ENABLED
      ? <BagServicePandenlijst scopeCode={BAG_SERVICE_SCOPE} bestaandeBagIds={bestaandeBagIds as Set<string>} bestaandeAdresSleutels={bestaandeAdressen} onHandmatigPromoveren={promoveerPrivateBagPanden} />
      : <>

    <section className="section-card p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2"><Label>Gemeente</Label><Input value={gemeente} onChange={e=>setGemeente(e.target.value)} placeholder="Bijv. Tilburg" /></div>
        <div><Label>Bouwjaar vanaf</Label><Input type="number" value={bouwjaarVan} onChange={e=>setBouwjaarVan(e.target.value)} placeholder="Geen minimum" /></div>
        <div><Label>Bouwjaar t/m</Label><Input type="number" value={bouwjaarTot} onChange={e=>setBouwjaarTot(e.target.value)} placeholder="Bijv. 1995" /></div>
        <div><Label>Maximaal resultaten</Label><Input type="number" min="5" max="100" value={limiet} onChange={e=>setLimiet(e.target.value)} /></div>
        <div className="md:col-span-3"><Label>Gebruiksdoelen</Label><div className="mt-2 flex flex-wrap gap-2">{GEBRUIKSDOELEN.map(([value,label])=><label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={gebruiksdoelen.includes(value)} onCheckedChange={()=>toggleDoel(value)} />{label}</label>)}</div></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={run} disabled={zoeken}>{zoeken?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}{zoeken?'PDOK doorzoeken…':'Zoek kandidaatpanden'}</Button><p className="self-center text-xs text-muted-foreground">BAG bevat gebouw- en adreskenmerken, geen eigenaar of verkoopbereidheid.</p></div>
    </section>

    {statistiek && <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <div className="section-card p-3"><p className="text-xs text-muted-foreground">BAG-panden onderzocht</p><p className="mt-1 text-lg font-semibold">{statistiek.onderzocht}</p></div>
      <div className="section-card p-3"><p className="text-xs text-muted-foreground">Buiten gemeente</p><p className="mt-1 text-lg font-semibold">{statistiek.buitenGemeente}</p></div>
      <div className="section-card p-3"><p className="text-xs text-muted-foreground">Niet passend op criteria</p><p className="mt-1 text-lg font-semibold">{statistiek.criteriaAfgevallen}</p></div>
      <div className="section-card p-3"><p className="text-xs text-muted-foreground">Niet te verrijken</p><p className="mt-1 text-lg font-semibold">{statistiek.technischAfgevallen}</p></div>
      <div className="section-card p-3"><p className="text-xs text-muted-foreground">Kandidaten</p><p className="mt-1 text-lg font-semibold">{statistiek.kandidaten}</p><p className="text-[11px] text-muted-foreground">uit {statistiek.paginas} pagina{statistiek.paginas===1?'':'’s'}</p></div>
    </section>}

    <section className="section-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b p-4"><div><h2 className="text-sm font-medium">Kandidaatpanden</h2><p className="text-xs text-muted-foreground">Selecteer alleen panden die je daadwerkelijk wilt onderzoeken.</p></div><Button onClick={save} disabled={opslaan || geselecteerd.size===0}><Plus className="mr-2 h-4 w-4"/>{opslaan?'Toevoegen…':`${geselecteerd.size} toevoegen`}</Button></div>
      {resultaten.length===0?<div className="p-10 text-center text-sm text-muted-foreground"><Database className="mx-auto mb-3 h-8 w-8 opacity-50"/>{statistiek ? 'Geen passende panden gevonden. Verruim bouwjaar of gebruiksdoelen.' : 'Voer een selectie uit om panden te tonen.'}</div>:<div className="divide-y">{resultaten.map(item=>{const bestaand=isBestaand(item);return <div key={item.bagPandId} className="flex min-w-0 items-start gap-3 p-4"><Checkbox className="mt-1" disabled={bestaand} checked={geselecteerd.has(item.bagPandId)} onCheckedChange={()=>setGeselecteerd(prev=>{const next=new Set(prev);if(next.has(item.bagPandId))next.delete(item.bagPandId);else next.add(item.bagPandId);return next;})}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-sm font-medium">{item.adres}</p>{bestaand&&<Badge variant="secondary">Al bekend</Badge>}<Badge variant="outline">{item.bouwjaar ?? 'Bouwjaar onbekend'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{[item.postcode,item.plaats,item.gebruiksdoel,item.oppervlakte?`${item.oppervlakte} m²`:null].filter(Boolean).join(' · ')}</p><p className="mt-1 font-mono-data text-[11px] text-muted-foreground">BAG-pand {item.bagPandId}</p></div>{item.latitude&&item.longitude&&<a className="shrink-0 text-muted-foreground hover:text-foreground" href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer" aria-label="Open in Google Maps"><MapPin className="h-4 w-4"/></a>}</div>})}</div>}
    </section>

    <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground"><Building2 className="mr-2 inline h-4 w-4"/>Na toevoegen open je ieder dossier voor visuele beoordeling, handmatig Kadaster- en eigenaaronderzoek en briefvoorbereiding. Er wordt niets automatisch besteld of verzonden.</div>
    </>}
  </div>;
}
