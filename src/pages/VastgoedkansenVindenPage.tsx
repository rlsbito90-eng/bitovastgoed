import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, Database, Loader2, MapPin, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { useDataStore } from '@/hooks/useDataStore';
import { zoekBagKandidatenMetStatistiek, type BagSelectieStatistiek } from '@/lib/pdokBagSelectie';
import { pastFunctiefilter, verrijkBagPanden, type VerrijktBagPand } from '@/lib/pandenverkenner';

const GEBRUIKSDOELEN = [
  ['woonfunctie', 'Wonen'], ['kantoorfunctie', 'Kantoor'], ['industriefunctie', 'Bedrijfsruimte / industrie'],
  ['winkelfunctie', 'Winkel'], ['bijeenkomstfunctie', 'Bijeenkomst / horeca'], ['gezondheidszorgfunctie', 'Zorg'],
  ['logiesfunctie', 'Hotel / logies'], ['onderwijsfunctie', 'Onderwijs'], ['sportfunctie', 'Sport'],
  ['overige gebruiksfunctie', 'Overig'],
] as const;

type Sorteerwijze = 'straat' | 'oppervlakte_desc' | 'bouwjaar_asc' | 'vbos_desc';

function norm(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function pandKey(pand: VerrijktBagPand) {
  return pand.bagPandId || norm(`${pand.adres}|${pand.postcode}`);
}

export default function VastgoedkansenVindenPage() {
  const { kansen, addKans } = useVastgoedkansen();
  const dataStore = useDataStore() as any;
  const objecten = dataStore.objecten ?? [];
  const signalen = dataStore.offMarketSignalen ?? dataStore.signalen ?? [];

  const [gemeente, setGemeente] = useState('Amsterdam');
  const [bouwjaarVan, setBouwjaarVan] = useState('');
  const [bouwjaarTot, setBouwjaarTot] = useState('');
  const [onderzoekslimiet, setOnderzoekslimiet] = useState('500');
  const [gebruiksdoelen, setGebruiksdoelen] = useState<string[]>([]);
  const [alleenGemengd, setAlleenGemengd] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [sorteerwijze, setSorteerwijze] = useState<Sorteerwijze>('straat');
  const [perPagina, setPerPagina] = useState(50);
  const [pagina, setPagina] = useState(1);
  const [resultaten, setResultaten] = useState<VerrijktBagPand[]>([]);
  const [statistiek, setStatistiek] = useState<BagSelectieStatistiek | null>(null);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [zoeken, setZoeken] = useState(false);
  const [opslaan, setOpslaan] = useState(false);

  const bestaandeBagIds = useMemo(() => new Set([
    ...kansen.map(k => k.bagPandId).filter(Boolean),
    ...objecten.map((o: any) => o.bagPandId).filter(Boolean),
    ...signalen.map((s: any) => s.bagPandId ?? s.bag_pand_id).filter(Boolean),
  ]), [kansen, objecten, signalen]);

  const bestaandeAdressen = useMemo(() => new Set([
    ...kansen.map(k => norm(`${k.adres}|${k.postcode}`)),
    ...objecten.map((o: any) => norm(`${o.adres ?? o.straatAdres ?? ''}|${o.postcode ?? ''}`)),
    ...signalen.map((s: any) => norm(`${s.adres ?? s.straat_adres ?? ''}|${s.postcode ?? ''}`)),
  ]), [kansen, objecten, signalen]);

  const isBestaand = (pand: VerrijktBagPand) => bestaandeBagIds.has(pand.bagPandId) || bestaandeAdressen.has(norm(`${pand.adres}|${pand.postcode}`));
  const toggleDoel = (doel: string) => setGebruiksdoelen(prev => prev.includes(doel) ? prev.filter(x => x !== doel) : [...prev, doel]);

  const gefilterd = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    return resultaten
      .filter(pand => pastFunctiefilter(pand, gebruiksdoelen))
      .filter(pand => !alleenGemengd || pand.gemengdGebruik)
      .filter(pand => !term || [pand.adres, pand.postcode, pand.plaats, pand.straat, pand.wijk, pand.buurt, ...pand.gebruiksdoelen]
        .some(value => String(value ?? '').toLowerCase().includes(term)))
      .sort((a, b) => {
        if (sorteerwijze === 'oppervlakte_desc') return (b.oppervlakte ?? 0) - (a.oppervlakte ?? 0);
        if (sorteerwijze === 'bouwjaar_asc') return (a.bouwjaar ?? 9999) - (b.bouwjaar ?? 9999);
        if (sorteerwijze === 'vbos_desc') return b.aantalVerblijfsobjecten - a.aantalVerblijfsobjecten;
        return `${a.straat ?? ''}|${a.adres}`.localeCompare(`${b.straat ?? ''}|${b.adres}`, 'nl', { numeric: true });
      });
  }, [resultaten, gebruiksdoelen, alleenGemengd, zoekterm, sorteerwijze]);

  const totaalPaginas = Math.max(1, Math.ceil(gefilterd.length / perPagina));
  const huidigePagina = gefilterd.slice((pagina - 1) * perPagina, pagina * perPagina);

  useEffect(() => setPagina(1), [zoekterm, sorteerwijze, gebruiksdoelen, alleenGemengd, perPagina]);
  useEffect(() => { if (pagina > totaalPaginas) setPagina(totaalPaginas); }, [pagina, totaalPaginas]);

  const stratenOpPagina = useMemo(() => {
    const groepen = new Map<string, VerrijktBagPand[]>();
    for (const pand of huidigePagina) {
      const straat = pand.straat || 'Straat onbekend';
      groepen.set(straat, [...(groepen.get(straat) ?? []), pand]);
    }
    return [...groepen.entries()];
  }, [huidigePagina]);

  const selecteerPanden = (panden: VerrijktBagPand[]) => setGeselecteerd(prev => {
    const next = new Set(prev);
    const selecteer = panden.some(pand => !isBestaand(pand) && !next.has(pandKey(pand)));
    panden.filter(pand => !isBestaand(pand)).forEach(pand => selecteer ? next.add(pandKey(pand)) : next.delete(pandKey(pand)));
    return next;
  });

  const togglePand = (pand: VerrijktBagPand) => setGeselecteerd(prev => {
    const next = new Set(prev);
    const key = pandKey(pand);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const run = async () => {
    if (!gemeente.trim()) { toast.error('Vul een gemeente in.'); return; }
    setZoeken(true);
    setGeselecteerd(new Set());
    setStatistiek(null);
    try {
      const maximum = Math.min(Math.max(Number(onderzoekslimiet) || 500, 25), 1000);
      const basis = await zoekBagKandidatenMetStatistiek({
        gemeente: gemeente.trim(),
        bouwjaarVan: bouwjaarVan ? Number(bouwjaarVan) : null,
        bouwjaarTot: bouwjaarTot ? Number(bouwjaarTot) : null,
        gebruiksdoelen: [],
        limiet: maximum,
      });
      const verrijkt = await verrijkBagPanden(basis.kandidaten);
      setResultaten(verrijkt);
      setStatistiek({ ...basis.statistiek, kandidaten: verrijkt.length });
      toast.success(`${verrijkt.length} BAG-panden verrijkt binnen gemeente ${gemeente.trim()}.`);
    } catch (error: any) {
      toast.error(error?.message ?? 'PDOK-selectie mislukt.');
    } finally { setZoeken(false); }
  };

  const save = async () => {
    const items = resultaten.filter(item => geselecteerd.has(pandKey(item)) && !isBestaand(item));
    if (!items.length) { toast.error('Selecteer minimaal één nieuw kandidaatpand.'); return; }
    setOpslaan(true);
    try {
      for (const item of items) {
        await addKans({
          adres: item.adres,
          postcode: item.postcode ?? undefined,
          plaats: item.plaats ?? gemeente,
          typeVastgoed: item.gebruiksdoelen.join(', ') || undefined,
          korteOmschrijving: `${item.gemengdGebruik ? 'Gemengd pand' : item.gebruiksdoelen[0] ?? 'BAG-pand'} — ${item.adres}`,
          herkomst: 'bag_selectie',
          herkomstReferentie: `PDOK BAG verkenning ${gemeente}`,
          bagPandId: item.bagPandId,
          bagVerblijfsobjectId: item.bagVerblijfsobjectId ?? undefined,
          redenInteressant: `Geselecteerd in Pandenverkenner: ${item.straat ?? item.adres}${item.buurt ? `, buurt ${item.buurt}` : ''}.`,
          status: 'te_beoordelen',
          prioriteit: 3,
        });
      }
      toast.success(`${items.length} panden toegevoegd aan Vastgoedkansen.`);
      setGeselecteerd(new Set());
    } catch (error: any) {
      toast.error(error?.message ?? 'Toevoegen aan Vastgoedkansen mislukt.');
    } finally { setOpslaan(false); }
  };

  const selecteerAlleGefilterde = () => {
    const beschikbaar = gefilterd.filter(pand => !isBestaand(pand));
    if (beschikbaar.length > 250 && !window.confirm(`Je selecteert ${beschikbaar.length} gefilterde panden. Er wordt nog niets opgeslagen, besteld of verzonden. Doorgaan?`)) return;
    selecteerPanden(beschikbaar);
  };

  const geselecteerdOpPagina = huidigePagina.filter(p => geselecteerd.has(pandKey(p))).length;
  const uitval = statistiek?.uitvalredenen;
  const dekking = statistiek?.dekking;
  const start = gefilterd.length ? (pagina - 1) * perPagina + 1 : 0;
  const einde = Math.min(pagina * perPagina, gefilterd.length);

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <Link to="/vastgoedkansen" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1.5 h-4 w-4"/>Vastgoedkansen</Link>
    <PageHeader title="Pandenverkenner" subtitle="Verken brede BAG-populaties, filter op functie en locatie en selecteer individuele panden of volledige straten." />

    <section className="section-card p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2"><Label>Gemeente</Label><Input value={gemeente} onChange={e=>setGemeente(e.target.value)} /></div>
        <div><Label>Bouwjaar vanaf</Label><Input type="number" value={bouwjaarVan} onChange={e=>setBouwjaarVan(e.target.value)} placeholder="Geen minimum" /></div>
        <div><Label>Bouwjaar t/m</Label><Input type="number" value={bouwjaarTot} onChange={e=>setBouwjaarTot(e.target.value)} placeholder="Geen maximum" /></div>
        <div><Label>Onderzoeksgrens</Label><Input type="number" min="25" max="1000" value={onderzoekslimiet} onChange={e=>setOnderzoekslimiet(e.target.value)} /><p className="mt-1 text-[11px] text-muted-foreground">Maximaal 1.000 verrijkte panden per browserrun.</p></div>
        <div className="md:col-span-3"><Label>Gebruiksdoelen</Label><p className="mt-1 text-xs text-muted-foreground">Niets geselecteerd betekent alle functies.</p><div className="mt-2 flex flex-wrap gap-2">{GEBRUIKSDOELEN.map(([value,label])=><label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={gebruiksdoelen.includes(value)} onCheckedChange={()=>toggleDoel(value)} />{label}</label>)}</div></div>
        <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-xs"><Checkbox checked={alleenGemengd} onCheckedChange={value=>setAlleenGemengd(Boolean(value))} />Alleen gemengd gebruik</label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={run} disabled={zoeken}>{zoeken?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}{zoeken?'BAG en VBO’s verwerken…':'Verken panden'}</Button><p className="self-center text-xs text-muted-foreground">Er wordt niets automatisch opgeslagen, besteld of verzonden.</p></div>
    </section>

    {statistiek && <>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="section-card p-3"><p className="text-xs text-muted-foreground">Unieke BAG-panden onderzocht</p><p className="mt-1 text-lg font-semibold">{statistiek.onderzocht}</p></div>
        <div className="section-card p-3"><p className="text-xs text-muted-foreground">Niet passend op criteria</p><p className="mt-1 text-lg font-semibold">{statistiek.criteriaAfgevallen}</p></div>
        <div className="section-card p-3"><p className="text-xs text-muted-foreground">Technisch niet compleet</p><p className="mt-1 text-lg font-semibold">{statistiek.technischAfgevallen}</p></div>
        <div className="section-card p-3"><p className="text-xs text-muted-foreground">Buiten gemeente</p><p className="mt-1 text-lg font-semibold">{statistiek.buitenGemeente}</p></div>
        <div className="section-card p-3"><p className="text-xs text-muted-foreground">Verrijkt / zichtbaar</p><p className="mt-1 text-lg font-semibold">{resultaten.length} / {gefilterd.length}</p></div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="section-card p-4">
          <h2 className="text-sm font-medium">Technische uitval uitgesplitst</h2>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <span className="text-muted-foreground">Geen VBO-relatie</span><span className="text-right font-medium">{uitval?.geenVboRelatie ?? 0}</span>
            <span className="text-muted-foreground">VBO-opvraag mislukt</span><span className="text-right font-medium">{uitval?.vboOpvraagMislukt ?? 0}</span>
            <span className="text-muted-foreground">Geen volledig adres</span><span className="text-right font-medium">{uitval?.geenVolledigAdres ?? 0}</span>
            <span className="text-muted-foreground">Geen geldige geometrie</span><span className="text-right font-medium">{uitval?.geenGeldigeGeometrie ?? 0}</span>
            <span className="text-muted-foreground">Duplicaat in raster/paginering</span><span className="text-right font-medium">{uitval?.duplicaat ?? 0}</span>
          </div>
        </div>
        <div className="section-card p-4">
          <h2 className="text-sm font-medium">Dekking van deze zoekrun</h2>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <span className="text-muted-foreground">Rastervakken geraakt</span><span className="text-right font-medium">{dekking?.geraakteRastervakken ?? 0} van {dekking?.totaalRastervakken ?? 0}</span>
            <span className="text-muted-foreground">Rastervakken volledig verwerkt</span><span className="text-right font-medium">{dekking?.volledigVerwerkteRastervakken ?? 0}</span>
            <span className="text-muted-foreground">PDOK-pagina’s gelezen</span><span className="text-right font-medium">{dekking?.paginasGelezen ?? 0}</span>
            <span className="text-muted-foreground">Vakken tegen paginalimiet</span><span className="text-right font-medium">{dekking?.paginalimietBereiktInVakken ?? 0}</span>
          </div>
          <div className={`mt-3 rounded-md border p-2 text-xs ${dekking?.onderzoeksgrensBereikt ? 'border-amber-500/30 bg-amber-500/5' : 'bg-muted/20'}`}>
            {dekking?.onderzoeksgrensBereikt
              ? 'De onderzoeksgrens is bereikt. Dit is geen volledige inventarisatie van de gemeente.'
              : dekking?.volledigVerwerkteRastervakken === dekking?.totaalRastervakken
                ? 'Alle rastervakken zijn binnen de ingestelde paginalimiet volledig verwerkt.'
                : 'De gemeente is gedeeltelijk verwerkt; één of meer rastervakken bevatten meer pagina’s dan deze browserrun leest.'}
          </div>
        </div>
      </section>
    </>}

    {resultaten.length > 0 && <section className="section-card p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_210px_150px_auto_auto]">
        <Input value={zoekterm} onChange={e=>setZoekterm(e.target.value)} placeholder="Filter op straat, buurt, wijk, postcode, adres of functie" />
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={sorteerwijze} onChange={e=>setSorteerwijze(e.target.value as Sorteerwijze)}><option value="straat">Straat en adres</option><option value="oppervlakte_desc">Grootste oppervlakte</option><option value="bouwjaar_asc">Oudste bouwjaar</option><option value="vbos_desc">Meeste VBO’s</option></select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={perPagina} onChange={e=>setPerPagina(Number(e.target.value))}><option value={25}>25 per pagina</option><option value={50}>50 per pagina</option><option value={100}>100 per pagina</option><option value={250}>250 per pagina</option></select>
        <Button variant="outline" onClick={()=>selecteerPanden(huidigePagina)}>Selecteer pagina</Button>
        <Button variant="outline" onClick={selecteerAlleGefilterde}>Selecteer alle {gefilterd.length}</Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{start}–{einde} van {gefilterd.length} · pagina {pagina} van {totaalPaginas}</span><span>{geselecteerd.size} geselecteerd · {geselecteerdOpPagina} op deze pagina · {Math.max(0, geselecteerd.size-geselecteerdOpPagina)} elders</span></div>
    </section>}

    <section className="section-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b p-4"><div><h2 className="text-sm font-medium">Kandidaatpanden per straat</h2><p className="text-xs text-muted-foreground">Bekende CRM-panden blijven zichtbaar, maar kunnen niet opnieuw worden toegevoegd.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>setGeselecteerd(new Set())} disabled={!geselecteerd.size}>Wis selectie</Button><Button onClick={save} disabled={opslaan || geselecteerd.size===0}><Plus className="mr-2 h-4 w-4"/>{opslaan?'Toevoegen…':`${geselecteerd.size} toevoegen`}</Button></div></div>
      {gefilterd.length===0?<div className="p-10 text-center text-sm text-muted-foreground"><Database className="mx-auto mb-3 h-8 w-8 opacity-50"/>{statistiek ? 'Geen panden binnen de actieve filters.' : 'Voer een verkenning uit om panden te tonen.'}</div>:<div className="divide-y">{stratenOpPagina.map(([straat,panden])=><div key={straat}><div className="flex items-center justify-between gap-3 bg-muted/25 px-4 py-2"><div><p className="text-sm font-medium">{straat}</p><p className="text-xs text-muted-foreground">{panden.length} op deze pagina · {gefilterd.filter(p=>p.straat===straat).length} in volledige filterset</p></div><Button size="sm" variant="outline" onClick={()=>selecteerPanden(gefilterd.filter(p=>p.straat===straat))}>Selecteer straat</Button></div><div className="divide-y">{panden.map(item=>{const bestaand=isBestaand(item);const key=pandKey(item);return <div key={key} className="flex min-w-0 items-start gap-3 p-4"><Checkbox className="mt-1" disabled={bestaand} checked={geselecteerd.has(key)} onCheckedChange={()=>togglePand(item)}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-sm font-medium">{item.adres}</p>{bestaand&&<Badge variant="secondary">Al bekend in CRM</Badge>}{item.gemengdGebruik&&<Badge>Gemengd</Badge>}<Badge variant="outline">{item.bouwjaar ?? 'Bouwjaar onbekend'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{[item.postcode,item.plaats,item.buurt,item.wijk,item.oppervlakte?`${Math.round(item.oppervlakte)} m² totaal`:null,`${item.aantalVerblijfsobjecten} VBO${item.aantalVerblijfsobjecten===1?'':'’s'}`].filter(Boolean).join(' · ')}</p><div className="mt-2 flex flex-wrap gap-1">{item.gebruiksdoelen.map(doel=><Badge key={doel} variant="outline" className="text-[10px]">{doel}{item.oppervlaktePerGebruiksdoel[doel]?` · ${Math.round(item.oppervlaktePerGebruiksdoel[doel])} m²`:''}</Badge>)}</div><p className="mt-2 font-mono-data text-[11px] text-muted-foreground">BAG-pand {item.bagPandId}</p></div>{item.latitude&&item.longitude&&<a className="shrink-0 text-muted-foreground hover:text-foreground" href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4"/></a>}</div>})}</div></div>)}</div>}
      {gefilterd.length>0&&<div className="flex items-center justify-between border-t p-4"><Button variant="outline" size="sm" onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1}><ChevronLeft className="mr-1 h-4 w-4"/>Vorige</Button><span className="text-xs text-muted-foreground">Pagina {pagina} van {totaalPaginas}</span><Button variant="outline" size="sm" onClick={()=>setPagina(p=>Math.min(totaalPaginas,p+1))} disabled={pagina===totaalPaginas}>Volgende<ChevronRight className="ml-1 h-4 w-4"/></Button></div>}
    </section>

    <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground"><Building2 className="mr-2 inline h-4 w-4"/>Selecteren is vrijblijvend. Pas na toevoegen aan Vastgoedkansen volgt visuele beoordeling, handmatig Kadaster- en eigenaaronderzoek en eventuele briefvoorbereiding.</div>
  </div>;
}
