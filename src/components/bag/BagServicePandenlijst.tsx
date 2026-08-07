import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';
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
import { bouwGoogleMapsAdresUrl } from '@/lib/bag/googleMaps';
import { zoekPandenViaService } from '@/lib/bag/queryTransport';
import { bepaalStraatSelectieStatus, toggleStraatSelectie } from '@/lib/bag/straatSelectie';
import {
  bewaarBagVerkenningsVoortgang,
  leesBagVerkenningsVoortgang,
  wisBagVerkenningsVoortgang,
  type BagVerkenningsVoortgang,
} from '@/lib/bag/verkenningsVoortgang';
import BagHandmatigePromotieDialog from './BagHandmatigePromotieDialog';
import BagCrmMatchBadge from './BagCrmMatchBadge';
import BagScopeStatus from './BagScopeStatus';
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
  const [paginas, setPaginas] = useState<BagVerkennerPand[][]>([]);
  const [paginaStartCursors, setPaginaStartCursors] = useState<Array<string | null>>([]);
  const [eerstePaginaNummer, setEerstePaginaNummer] = useState(1);
  const [paginaIndex, setPaginaIndex] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [heeftVolgende, setHeeftVolgende] = useState(true);
  const [laden, setLaden] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [preflight, setPreflight] = useState<BagSelectiePreflight | null>(null);
  const [promotieOpen, setPromotieOpen] = useState(false);
  const [promotieBezig, setPromotieBezig] = useState(false);
  const [toonNaarBoven, setToonNaarBoven] = useState(false);
  const [hervatpunt, setHervatpunt] = useState<BagVerkenningsVoortgang | null>(
    () => leesBagVerkenningsVoortgang(scopeCode),
  );
  const resultatenTopRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<BagVerkennerFilters>({
    zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'identificatie',
  });

  useEffect(() => {
    const controleerScroll = () => setToonNaarBoven(window.scrollY > 500);
    controleerScroll();
    window.addEventListener('scroll', controleerScroll, { passive: true });
    return () => window.removeEventListener('scroll', controleerScroll);
  }, []);

  useEffect(() => {
    setPaginas([]);
    setPaginaStartCursors([]);
    setEerstePaginaNummer(1);
    setPaginaIndex(0);
    setCursor(null);
    setHeeftVolgende(true);
    setGeselecteerd(new Set());
    setPreflight(null);
    setHervatpunt(leesBagVerkenningsVoortgang(scopeCode));
  }, [scopeCode]);

  const panden = useMemo(() => paginas.flat(), [paginas]);
  const actievePagina = paginas[paginaIndex] ?? [];
  const actuelePaginaNummer = eerstePaginaNummer + paginaIndex;
  const zichtbaar = useMemo(
    () => filterEnSorteerBagPanden(actievePagina, filters),
    [actievePagina, filters],
  );
  const straatgroepen = useMemo(() => {
    const groepen = new Map<string, BagVerkennerPand[]>();
    zichtbaar.forEach((pand) => {
      const straat = pand.straat ?? 'Straat onbekend';
      groepen.set(straat, [...(groepen.get(straat) ?? []), pand]);
    });
    return [...groepen.entries()];
  }, [zichtbaar]);
  const nummerPerPand = useMemo(() => {
    const inWeergaveVolgorde = straatgroepen.flatMap(([, straatPanden]) => straatPanden);
    return new Map(
      inWeergaveVolgorde.map((pand, index) => [
        pand.bagPandId,
        (actuelePaginaNummer - 1) * PAGE_SIZE + index + 1,
      ]),
    );
  }, [actuelePaginaNummer, straatgroepen]);

  const context = { bestaandeBagIds, bestaandeAdresSleutels, maximaalAantal: 250 };
  const isGeblokkeerd = (pand: BagVerkennerPand) => blokkadeVoorPand(pand, context) !== null;

  const scrollNaarResultaten = () => {
    requestAnimationFrame(() => resultatenTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const bewaarWerkpositie = (paginaNummer: number, startCursor: string | null) => {
    const opgeslagen = bewaarBagVerkenningsVoortgang(scopeCode, paginaNummer, startCursor);
    if (opgeslagen) setHervatpunt(opgeslagen);
  };

  const laad = async (opnieuw = false, hervattenVanaf: BagVerkenningsVoortgang | null = null) => {
    setLaden(true);
    try {
      const startCursor = hervattenVanaf?.startCursor ?? (opnieuw ? null : cursor);
      const doelPaginaNummer = hervattenVanaf?.paginaNummer
        ?? (opnieuw ? 1 : eerstePaginaNummer + paginas.length);
      const resultaat = await zoekPandenViaService<BagServicePandRij>({
        scopeCode, naIdentificatie: startCursor, limiet: PAGE_SIZE,
      });
      const nieuw = resultaat.rows.map(normaliseerBagServicePand);
      if (!nieuw.length) {
        setHeeftVolgende(false);
        toast.info('Geen verdere BAG-panden gevonden.');
        return;
      }

      if (opnieuw || hervattenVanaf) {
        setPaginas([nieuw]);
        setPaginaStartCursors([startCursor]);
        setEerstePaginaNummer(doelPaginaNummer);
        setPaginaIndex(0);
        setGeselecteerd(new Set());
      } else {
        const nieuwePaginaIndex = paginas.length;
        setPaginas(previous => [...previous, nieuw]);
        setPaginaStartCursors(previous => [...previous, startCursor]);
        setPaginaIndex(nieuwePaginaIndex);
      }
      setPreflight(null);
      setCursor(nieuw.at(-1)?.cursor ?? null);
      setHeeftVolgende(nieuw.length === PAGE_SIZE);
      bewaarWerkpositie(doelPaginaNummer, startCursor);
      scrollNaarResultaten();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'BAG-lijst laden mislukt.');
    } finally {
      setLaden(false);
    }
  };

  const gaNaarPagina = (volgendeIndex: number) => {
    if (volgendeIndex < 0 || volgendeIndex >= paginas.length) return;
    setPaginaIndex(volgendeIndex);
    setPreflight(null);
    bewaarWerkpositie(
      eerstePaginaNummer + volgendeIndex,
      paginaStartCursors[volgendeIndex] ?? null,
    );
    scrollNaarResultaten();
  };

  const gaNaarVolgende = () => {
    if (paginaIndex < paginas.length - 1) {
      gaNaarPagina(paginaIndex + 1);
      return;
    }
    if (heeftVolgende) void laad(false);
  };

  const beginOpnieuw = () => {
    wisBagVerkenningsVoortgang(scopeCode);
    setHervatpunt(null);
    void laad(true);
  };

  const toggleFunctie = (functie: string) => setFilters(previous => ({
    ...previous,
    gebruiksdoelen: previous.gebruiksdoelen.includes(functie)
      ? previous.gebruiksdoelen.filter(value => value !== functie)
      : [...previous.gebruiksdoelen, functie],
  }));

  const togglePand = (pand: BagVerkennerPand) => {
    if (isGeblokkeerd(pand)) return;
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
    const beschikbaar = selectie.filter(pand => !isGeblokkeerd(pand));
    const next = new Set([...geselecteerd, ...beschikbaar.map(pand => pand.bagPandId)]);
    if (next.size > 250) return toast.error('Deze selectie zou de limiet van 250 overschrijden.');
    setGeselecteerd(next);
    setPreflight(null);
  };

  const toggleStraat = (straatPanden: BagVerkennerPand[]) => {
    const next = toggleStraatSelectie(straatPanden, geselecteerd, isGeblokkeerd, 250);
    if (!next) {
      toast.error('Deze straatselectie zou de limiet van 250 overschrijden.');
      return;
    }
    setGeselecteerd(next);
    setPreflight(null);
  };

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

  const paginering = paginas.length > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
      <span>
        Resultaten {(actuelePaginaNummer - 1) * PAGE_SIZE + 1}–{(actuelePaginaNummer - 1) * PAGE_SIZE + actievePagina.length} · pagina {actuelePaginaNummer}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={laden || paginaIndex === 0} onClick={() => gaNaarPagina(paginaIndex - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" />Vorige
        </Button>
        {paginas.map((_, index) => {
          const paginaNummer = eerstePaginaNummer + index;
          return (
            <Button
              key={paginaNummer}
              variant={index === paginaIndex ? 'default' : 'outline'}
              size="sm"
              className="min-w-9 px-2"
              disabled={laden}
              onClick={() => gaNaarPagina(index)}
              aria-label={`Ga naar pagina ${paginaNummer}`}
            >
              {paginaNummer}
            </Button>
          );
        })}
        <Button variant="outline" size="sm" disabled={laden || (paginaIndex === paginas.length - 1 && !heeftVolgende)} onClick={gaNaarVolgende}>
          {laden ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Volgende<ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return <section className="section-card overflow-hidden">
    <div className="border-b p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Database className="h-4 w-4"/><h2 className="text-sm font-medium">Private BAG-Pandenverkenner</h2><Badge variant="outline">Scope {scopeCode}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">Geauthenticeerde, begrensde serverquery met BAG-adressen, functies en VBO-totalen. Geen kaart en geen automatische opslag.</p>
        </div>
        <Button onClick={() => laad(true)} disabled={laden}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}Pagina 1 laden</Button>
      </div>
      <div className="mt-4"><BagScopeStatus actieveScopeCode={scopeCode} /></div>
      {!panden.length && hervatpunt && hervatpunt.paginaNummer > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary/[0.03] p-4">
          <div>
            <p className="text-sm font-medium">Verder waar je was gebleven</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pagina {hervatpunt.paginaNummer} · resultaten {(hervatpunt.paginaNummer - 1) * PAGE_SIZE + 1}–{hervatpunt.paginaNummer * PAGE_SIZE}
              {' · '}opgeslagen {new Date(hervatpunt.opgeslagenOp).toLocaleString('nl-NL')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void laad(false, hervatpunt)} disabled={laden}>
              {laden ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Verder verkennen
            </Button>
            <Button size="sm" variant="outline" onClick={beginOpnieuw} disabled={laden}>Begin opnieuw</Button>
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_190px_auto]">
        <Input value={filters.zoekterm} onChange={event => setFilters(previous => ({ ...previous, zoekterm: event.target.value }))} placeholder="Filter huidige pagina op adres, plaats, postcode, BAG-ID of functie" />
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.sortering} onChange={event => setFilters(previous => ({ ...previous, sortering: event.target.value as BagVerkennerFilters['sortering'] }))}>
          <option value="identificatie">BAG-identificatie</option><option value="adres">Adres</option><option value="bouwjaar">Oudste bouwjaar</option><option value="oppervlakte">Grootste oppervlakte</option>
        </select>
        <label className="flex items-center gap-2 rounded-md border px-3 text-xs"><Checkbox checked={filters.alleenGemengd} onCheckedChange={value => setFilters(previous => ({ ...previous, alleenGemengd: Boolean(value) }))}/>Alleen gemengd</label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{FUNCTIES.map(functie => <label key={functie} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={filters.gebruiksdoelen.includes(functie)} onCheckedChange={() => toggleFunctie(functie)}/>{functie}</label>)}</div>
    </div>

    <div ref={resultatenTopRef} />
    {paginering}
    {panden.length>0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><p className="text-xs text-muted-foreground">{geselecteerd.size} geselecteerd over {paginas.length} geladen pagina{paginas.length === 1 ? '' : '’s'}; selectie blijft lokaal tot de preflight.</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => selecteerPanden(zichtbaar)}>Selecteer zichtbare pagina</Button><Button variant="outline" size="sm" disabled={!geselecteerd.size} onClick={() => { setGeselecteerd(new Set()); setPreflight(null); }}>Wis selectie</Button><Button size="sm" disabled={!geselecteerd.size} onClick={() => setPreflight(beoordeelBagSelectie(panden, geselecteerd, context))}><CheckCircle2 className="mr-2 h-4 w-4"/>Controleer selectie</Button></div></div>}
    {preflight && <div className={`border-t p-4 text-sm ${preflight.toegestaan ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{preflight.toegestaan ? 'Selectie technisch gereed voor handmatige promotie' : 'Selectie geblokkeerd'}</p><p className="mt-1 text-xs text-muted-foreground">{preflight.geselecteerd} gecontroleerd · {preflight.kandidaten.length} kandidaat · {preflight.blokkades.length} blokkade(s). Er is niets opgeslagen.</p></div>{preflight.toegestaan&&<Button size="sm" onClick={() => setPromotieOpen(true)}>Handmatig toevoegen…</Button>}</div>{preflight.blokkades.length>0&&<ul className="mt-2 list-disc pl-5 text-xs">{preflight.blokkades.map(item=><li key={`${item.bagPandId}:${item.reden}`}>{item.bagPandId}: {REDEN_LABEL[item.reden]}</li>)}</ul>}</div>}

    {!panden.length ? <div className="p-10 text-center text-sm text-muted-foreground">{hervatpunt?.paginaNummer && hervatpunt.paginaNummer > 1 ? 'Kies Verder verkennen om je laatste werkpositie te hervatten, of begin opnieuw bij pagina 1.' : 'Laad pagina 1 uit de actieve BAG-dataset.'}</div> : <div className="divide-y">{straatgroepen.map(([straat, straatPanden]) => {
      const status = bepaalStraatSelectieStatus(straatPanden, geselecteerd, isGeblokkeerd);
      return <div key={straat} className={status.geselecteerd > 0 ? 'bg-primary/[0.02]' : undefined}>
        <div className="flex items-center justify-between gap-3 bg-muted/25 px-4 py-2">
          <div><p className="text-sm font-medium">{straat}</p><p className="text-xs text-muted-foreground">{status.geselecteerd} van {status.beschikbaar} selecteerbaar geselecteerd{straatPanden.length > status.beschikbaar ? ` · ${straatPanden.length - status.beschikbaar} al bekend/geblokkeerd` : ''}</p></div>
          <Button size="sm" variant={status.allesGeselecteerd ? 'secondary' : 'outline'} disabled={status.beschikbaar === 0} onClick={() => toggleStraat(straatPanden)}>{status.allesGeselecteerd ? 'Deselecteer straat' : status.gedeeltelijkGeselecteerd ? 'Selecteer resterende' : 'Selecteer straat'}</Button>
        </div>
        <div className="divide-y">{straatPanden.map(pand => {
          const blokkade = blokkadeVoorPand(pand, context);
          const isGeselecteerd = geselecteerd.has(pand.bagPandId);
          const rijSelecteerbaar = blokkade === null;
          return <div
            key={`${pand.datasetversieId}:${pand.bagPandId}:${pand.voorkomenSleutel}`}
            className={`flex items-start gap-3 p-4 transition-colors ${isGeselecteerd ? 'bg-primary/[0.06]' : rijSelecteerbaar ? 'cursor-pointer hover:bg-muted/35' : ''}`}
            role={rijSelecteerbaar ? 'button' : undefined}
            tabIndex={rijSelecteerbaar ? 0 : undefined}
            aria-pressed={rijSelecteerbaar ? isGeselecteerd : undefined}
            onClick={rijSelecteerbaar ? () => togglePand(pand) : undefined}
            onKeyDown={rijSelecteerbaar ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                togglePand(pand);
              }
            } : undefined}
          >
            <div className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full border bg-background px-1 text-[11px] font-medium text-muted-foreground" aria-label={`Volgnummer ${nummerPerPand.get(pand.bagPandId)}`}>{nummerPerPand.get(pand.bagPandId)}</div>
            <Checkbox
              className="mt-1"
              disabled={blokkade !== null}
              checked={isGeselecteerd}
              onClick={event => event.stopPropagation()}
              onCheckedChange={() => togglePand(pand)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{pand.adres}</p>{pand.gemengdGebruik&&<Badge>Gemengd</Badge>}{pand.status&&<Badge variant="outline">{pand.status}</Badge>}{blokkade&&<BagCrmMatchBadge pand={pand} fallbackLabel={REDEN_LABEL[blokkade]}/>}</div>
              <p className="mt-1 text-xs text-muted-foreground">{[pand.postcode,pand.plaats,pand.bouwjaar?`Bouwjaar ${pand.bouwjaar}`:null,pand.oppervlakte?`${Math.round(pand.oppervlakte)} m² totaal`:null,`${pand.aantalVerblijfsobjecten} VBO${pand.aantalVerblijfsobjecten === 1 ? '' : '’s'}`].filter(Boolean).join(' · ')}</p>
              <div className="mt-2 flex flex-wrap gap-1">{pand.gebruiksdoelen.map(doel => <Badge key={doel} variant="secondary" className="text-[10px]">{doel}</Badge>)}</div>
              <p className="mt-2 font-mono-data text-[11px] text-muted-foreground">BAG-pand {pand.bagPandId}</p>
            </div>
            <a
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted"
              href={bouwGoogleMapsAdresUrl({ adres: pand.adres, postcode: pand.postcode, plaats: pand.plaats })}
              target="_blank"
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
              aria-label={`Open ${pand.adres} in Google Maps`}
              title="Open adres in Google Maps"
            >
              <MapPin className="h-4 w-4"/>
              <span className="hidden sm:inline">Google Maps</span>
            </a>
          </div>;
        })}</div>
      </div>;
    })}</div>}

    {panden.length>0 && <div className="border-t">{paginering}<div className="px-4 py-3 text-xs text-muted-foreground">{zichtbaar.length} zichtbaar op deze pagina · {panden.length} panden verdeeld over {paginas.length} geladen pagina{paginas.length === 1 ? '' : '’s'}</div></div>}
    {toonNaarBoven && <Button className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg" size="icon" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Naar boven" title="Naar boven"><ArrowUp className="h-4 w-4" /></Button>}
    <BagHandmatigePromotieDialog open={promotieOpen} aantal={preflight?.kandidaten.length ?? 0} bezig={promotieBezig} onOpenChange={setPromotieOpen} onConfirm={promoveer}/>
  </section>;
}
