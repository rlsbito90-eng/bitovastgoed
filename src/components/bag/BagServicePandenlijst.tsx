import { useMemo, useState } from 'react';
import { CheckCircle2, Database, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  filterEnSorteerBagPanden,
  normaliseerBagServicePand,
  type BagServicePandRij,
  type BagVerkennerFilters,
  type BagVerkennerPand,
} from '@/lib/bag/pandenverkennerModel';
import { zoekPandenViaService } from '@/lib/bag/queryTransport';
import BagHandmatigePromotieDialog from './BagHandmatigePromotieDialog';
import {
  beoordeelBagSelectie,
  blokkadeVoorPand,
  type BagSelectiePreflight,
} from '@/lib/bag/selectiePreflight';
import type { BagPromotieResultaat } from '@/lib/bag/handmatigePromotie';

const PAGE_SIZE = 100;
const FUNCTIES = [
  'woonfunctie', 'kantoorfunctie', 'industriefunctie', 'winkelfunctie',
  'bijeenkomstfunctie', 'gezondheidszorgfunctie', 'logiesfunctie',
  'onderwijsfunctie', 'sportfunctie', 'overige gebruiksfunctie',
];

interface Props {
  scopeCode: string;
  bestaandeBagIds: Set<string>;
  bestaandeAdresSleutels: Set<string>;
  onHandmatigPromoveren: (panden: BagVerkennerPand[]) => Promise<BagPromotieResultaat>;
}

const REDEN_LABEL = {
  bestaand_bag_id: 'BAG-ID bestaat al in CRM',
  bestaand_adres: 'Adres bestaat al in CRM',
  onvolledig_adres: 'Bronadres is onvolledig',
  selectielimiet: 'Selectielimiet overschreden',
} as const;

export default function BagServicePandenlijst({
  scopeCode, bestaandeBagIds, bestaandeAdresSleutels, onHandmatigPromoveren,
}: Props) {
  const [panden, setPanden] = useState<BagVerkennerPand[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [heeftVolgende, setHeeftVolgende] = useState(true);
  const [laden, setLaden] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [preflight, setPreflight] = useState<BagSelectiePreflight | null>(null);
  const [promotieOpen, setPromotieOpen] = useState(false);
  const [promotieBezig, setPromotieBezig] = useState(false);
  const [filters, setFilters] = useState<BagVerkennerFilters>({
    zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'identificatie',
  });
  const zichtbaar = useMemo(() => filterEnSorteerBagPanden(panden, filters), [panden, filters]);
  const straatgroepen = useMemo(() => {
    const groepen = new Map<string, BagVerkennerPand[]>();
    zichtbaar.forEach((pand) => {
      const straat = pand.straat ?? 'Straat onbekend';
      groepen.set(straat, [...(groepen.get(straat) ?? []), pand]);
    });
    return [...groepen.entries()];
  }, [zichtbaar]);

  const laad = async (opnieuw = false) => {
    setLaden(true);
    try {
      const resultaat = await zoekPandenViaService<BagServicePandRij>({
        scopeCode, naIdentificatie: opnieuw ? null : cursor, limiet: PAGE_SIZE,
      });
      const nieuw = resultaat.rows.map(normaliseerBagServicePand);
      setPanden(previous => opnieuw ? nieuw : [...previous, ...nieuw]);
      if (opnieuw) setGeselecteerd(new Set());
      setPreflight(null);
      setCursor(nieuw.at(-1)?.cursor ?? null);
      setHeeftVolgende(nieuw.length === PAGE_SIZE);
      if (!nieuw.length) toast.info('Geen verdere BAG-panden gevonden.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'BAG-lijst laden mislukt.');
    } finally {
      setLaden(false);
    }
  };

  const toggleFunctie = (functie: string) => setFilters(previous => ({
    ...previous,
    gebruiksdoelen: previous.gebruiksdoelen.includes(functie)
      ? previous.gebruiksdoelen.filter(value => value !== functie)
      : [...previous.gebruiksdoelen, functie],
  }));
  const context = { bestaandeBagIds, bestaandeAdresSleutels, maximaalAantal: 250 };
  const togglePand = (pand: BagVerkennerPand) => {
    if (blokkadeVoorPand(pand, context)) return;
    setPreflight(null);
    setGeselecteerd(previous => {
      const next = new Set(previous);
      if (next.has(pand.bagPandId)) next.delete(pand.bagPandId);
      else if (next.size < 250) next.add(pand.bagPandId);
      else toast.error('Selecteer maximaal 250 panden per preflight.');
      return next;
    });
  };
  const selecteerPanden = (selectie: BagVerkennerPand[]) => {
    const beschikbaar = selectie.filter(pand => !blokkadeVoorPand(pand, context));
    const next = new Set([...geselecteerd, ...beschikbaar.map(pand => pand.bagPandId)]);
    if (next.size > 250) return toast.error('Deze selectie zou de limiet van 250 overschrijden.');
    setGeselecteerd(next);
    setPreflight(null);
  };
  const selecteerZichtbaar = () => selecteerPanden(zichtbaar);
  const promoveer = async () => {
    if (!preflight?.toegestaan) return;
    setPromotieBezig(true);
    try {
      const resultaat = await onHandmatigPromoveren(preflight.kandidaten);
      setGeselecteerd(previous => {
        const next = new Set(previous);
        resultaat.toegevoegd.forEach(id => next.delete(id));
        return next;
      });
      if (resultaat.toegevoegd.length) toast.success(`${resultaat.toegevoegd.length} panden handmatig toegevoegd aan Vastgoedkansen.`);
      if (resultaat.mislukt.length) toast.error(`${resultaat.mislukt.length} panden konden niet worden toegevoegd; controleer de bijgewerkte CRM-status.`);
      setPreflight(null);
      setPromotieOpen(false);
    } finally {
      setPromotieBezig(false);
    }
  };

  return <section className="section-card overflow-hidden">
    <div className="border-b p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Database className="h-4 w-4"/><h2 className="text-sm font-medium">Private BAG-Pandenverkenner</h2><Badge variant="outline">Scope {scopeCode}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">Geauthenticeerde, begrensde serverquery met BAG-adressen, functies en VBO-totalen. Geen kaart en geen automatische opslag.</p>
        </div>
        <Button onClick={() => laad(true)} disabled={laden}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}Eerste 100 laden</Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_190px_auto]">
        <Input value={filters.zoekterm} onChange={event => setFilters(previous => ({ ...previous, zoekterm: event.target.value }))} placeholder="Filter geladen pagina’s op adres, plaats, postcode, BAG-ID of functie" />
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.sortering} onChange={event => setFilters(previous => ({ ...previous, sortering: event.target.value as BagVerkennerFilters['sortering'] }))}>
          <option value="identificatie">BAG-identificatie</option><option value="adres">Adres</option><option value="bouwjaar">Oudste bouwjaar</option><option value="oppervlakte">Grootste oppervlakte</option>
        </select>
        <label className="flex items-center gap-2 rounded-md border px-3 text-xs"><Checkbox checked={filters.alleenGemengd} onCheckedChange={value => setFilters(previous => ({ ...previous, alleenGemengd: Boolean(value) }))}/>Alleen gemengd</label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{FUNCTIES.map(functie => <label key={functie} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={filters.gebruiksdoelen.includes(functie)} onCheckedChange={() => toggleFunctie(functie)}/>{functie}</label>)}</div>
    </div>

    {panden.length>0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><p className="text-xs text-muted-foreground">{geselecteerd.size} geselecteerd; selectie blijft lokaal tot de preflight.</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={selecteerZichtbaar}>Selecteer zichtbaar</Button><Button variant="outline" size="sm" disabled={!geselecteerd.size} onClick={() => { setGeselecteerd(new Set()); setPreflight(null); }}>Wis selectie</Button><Button size="sm" disabled={!geselecteerd.size} onClick={() => setPreflight(beoordeelBagSelectie(panden, geselecteerd, context))}><CheckCircle2 className="mr-2 h-4 w-4"/>Controleer selectie</Button></div></div>}
    {!panden.length ? <div className="p-10 text-center text-sm text-muted-foreground">Laad de eerste begrensde pagina uit de actieve BAG-dataset.</div> : <div className="divide-y">{straatgroepen.map(([straat, straatPanden]) => <div key={straat}>
      <div className="flex items-center justify-between gap-3 bg-muted/25 px-4 py-2"><div><p className="text-sm font-medium">{straat}</p><p className="text-xs text-muted-foreground">{straatPanden.length} pand{straatPanden.length === 1 ? '' : 'en'} in de geladen filterset</p></div><Button size="sm" variant="outline" onClick={() => selecteerPanden(straatPanden)}>Selecteer straat</Button></div>
      <div className="divide-y">{straatPanden.map(pand => { const blokkade = blokkadeVoorPand(pand, context); return <div key={`${pand.datasetversieId}:${pand.bagPandId}:${pand.voorkomenSleutel}`} className="flex items-start gap-3 p-4">
        <Checkbox className="mt-1" disabled={blokkade !== null} checked={geselecteerd.has(pand.bagPandId)} onCheckedChange={() => togglePand(pand)}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{pand.adres}</p>{pand.gemengdGebruik&&<Badge>Gemengd</Badge>}{pand.status&&<Badge variant="outline">{pand.status}</Badge>}{blokkade&&<Badge variant="secondary">{REDEN_LABEL[blokkade]}</Badge>}</div>
        <p className="mt-1 text-xs text-muted-foreground">{[pand.postcode,pand.plaats,pand.bouwjaar?`Bouwjaar ${pand.bouwjaar}`:null,pand.oppervlakte?`${Math.round(pand.oppervlakte)} m² totaal`:null,`${pand.aantalVerblijfsobjecten} VBO${pand.aantalVerblijfsobjecten === 1 ? '' : '’s'}`].filter(Boolean).join(' · ')}</p>
        <div className="mt-2 flex flex-wrap gap-1">{pand.gebruiksdoelen.map(doel => <Badge key={doel} variant="secondary" className="text-[10px]">{doel}</Badge>)}</div>
        <p className="mt-2 font-mono-data text-[11px] text-muted-foreground">BAG-pand {pand.bagPandId}</p>
      </div></div>; })}</div>
    </div>)}</div>}
    {preflight && <div className={`border-t p-4 text-sm ${preflight.toegestaan ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{preflight.toegestaan ? 'Selectie technisch gereed voor handmatige promotie' : 'Selectie geblokkeerd'}</p><p className="mt-1 text-xs text-muted-foreground">{preflight.geselecteerd} gecontroleerd · {preflight.kandidaten.length} kandidaat · {preflight.blokkades.length} blokkade(s). Er is niets opgeslagen.</p></div>{preflight.toegestaan&&<Button size="sm" onClick={() => setPromotieOpen(true)}>Handmatig toevoegen…</Button>}</div>{preflight.blokkades.length>0&&<ul className="mt-2 list-disc pl-5 text-xs">{preflight.blokkades.map(item=><li key={`${item.bagPandId}:${item.reden}`}>{item.bagPandId}: {REDEN_LABEL[item.reden]}</li>)}</ul>}</div>}
    {panden.length>0 && <div className="flex items-center justify-between gap-3 border-t p-4 text-xs text-muted-foreground"><span>{zichtbaar.length} zichtbaar van {panden.length} geladen</span><Button variant="outline" size="sm" disabled={laden || !heeftVolgende} onClick={() => laad(false)}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}{heeftVolgende?'Volgende 100 laden':'Einde bereikt'}</Button></div>}
    <BagHandmatigePromotieDialog open={promotieOpen} aantal={preflight?.kandidaten.length ?? 0} bezig={promotieBezig} onOpenChange={setPromotieOpen} onConfirm={promoveer}/>
  </section>;
}
