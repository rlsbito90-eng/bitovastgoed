import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader2,
  MapPin,
  MapPinned,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  filterEnSorteerBagPanden,
  normaliseerBagServicePandV2,
  type BagServicePandV2Rij,
  type BagVerkennerFilters,
  type BagVerkennerPand,
} from '@/lib/bag/pandenverkennerModel';
import { bouwGoogleMapsAdresUrl } from '@/lib/bag/googleMaps';
import { haalCbsGebiedsopties, zoekPandenViaServiceV4 } from '@/lib/bag/queryTransport';
import type { BagCbsGebiedsoptie } from '@/lib/bag/queryService';
import { bepaalStraatSelectieStatus, toggleStraatSelectie } from '@/lib/bag/straatSelectie';
import BagHandmatigePromotieDialog from './BagHandmatigePromotieDialog';
import BagCrmMatchBadge from './BagCrmMatchBadge';
import BagScopeStatus from './BagScopeStatus';
import BagGebiedsfilters from './BagGebiedsfilters';
import BagPandenKaart from './BagPandenKaart';
import type { BagKaartFilters } from '@/lib/bag/kaartModel';
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
const PANDSTATUSSEN = [
  'Pand in gebruik',
  'Pand in gebruik (niet ingemeten)',
  'Bouwvergunning verleend',
  'Bouw gestart',
  'Verbouwing pand',
  'Sloopvergunning verleend',
  'Pand gesloopt',
  'Niet gerealiseerd pand',
  'Pand ten onrechte opgevoerd',
];

interface Props {
  scopeCode: string;
  bestaandeBagIds: Set<string>;
  bestaandeAdresSleutels: Set<string>;
  onHandmatigPromoveren: (panden: BagVerkennerPand[]) => Promise<BagPromotieResultaat>;
}

interface ServerFilters {
  statussen: string[];
  wijkCodes: string[];
  buurtCodes: string[];
  bouwjaarVan: string;
  bouwjaarTot: string;
  vboSomVan: string;
  vboSomTot: string;
  vboMaxVan: string;
  vboMaxTot: string;
  vboAantalVan: string;
  vboAantalTot: string;
  vboModus: 'alle' | 'met_vbo' | 'zonder_vbo';
}

const LEGE_SERVER_FILTERS: ServerFilters = {
  statussen: [],
  wijkCodes: [],
  buurtCodes: [],
  bouwjaarVan: '',
  bouwjaarTot: '',
  vboSomVan: '',
  vboSomTot: '',
  vboMaxVan: '',
  vboMaxTot: '',
  vboAantalVan: '',
  vboAantalTot: '',
  vboModus: 'alle',
};

const REDEN_LABEL = {
  bestaand_bag_id: 'BAG-ID bestaat al in CRM',
  bestaand_adres: 'Adres bestaat al in CRM',
  onvolledig_adres: 'Bronadres is onvolledig',
  selectielimiet: 'Selectielimiet overschreden',
} as const;

function optioneelGetal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function BagServicePandenlijst({
  scopeCode, bestaandeBagIds, bestaandeAdresSleutels, onHandmatigPromoveren,
}: Props) {
  const [paginas, setPaginas] = useState<BagVerkennerPand[][]>([]);
  const [paginaIndex, setPaginaIndex] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [heeftVolgende, setHeeftVolgende] = useState(true);
  const [laden, setLaden] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [preflight, setPreflight] = useState<BagSelectiePreflight | null>(null);
  const [promotieOpen, setPromotieOpen] = useState(false);
  const [promotieBezig, setPromotieBezig] = useState(false);
  const [toonNaarBoven, setToonNaarBoven] = useState(false);
  const resultatenTopRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<BagVerkennerFilters>({
    zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'identificatie',
  });
  const [serverFilters, setServerFilters] = useState<ServerFilters>(LEGE_SERVER_FILTERS);
  const [gebiedsopties, setGebiedsopties] = useState<BagCbsGebiedsoptie[]>([]);
  const [gebiedenLaden, setGebiedenLaden] = useState(false);
  const [weergave, setWeergave] = useState<'zoeken' | 'kaart'>('zoeken');
  const [toonMeerFilters, setToonMeerFilters] = useState(false);

  useEffect(() => {
    let actief = true;
    setGebiedenLaden(true);
    void haalCbsGebiedsopties(scopeCode)
      .then(resultaat => { if (actief) setGebiedsopties(resultaat.rows); })
      .catch(error => { if (actief) toast.error(error instanceof Error ? error.message : 'Wijken en buurten laden mislukt.'); })
      .finally(() => { if (actief) setGebiedenLaden(false); });
    return () => { actief = false; };
  }, [scopeCode]);

  useEffect(() => {
    const controleerScroll = () => setToonNaarBoven(window.scrollY > 500);
    controleerScroll();
    window.addEventListener('scroll', controleerScroll, { passive: true });
    return () => window.removeEventListener('scroll', controleerScroll);
  }, []);

  useEffect(() => {
    setPaginas([]);
    setPaginaIndex(0);
    setCursor(null);
    setHeeftVolgende(true);
    setGeselecteerd(new Set());
    setPreflight(null);
  }, [serverFilters, filters.gebruiksdoelen, filters.alleenGemengd]);

  const panden = useMemo(() => paginas.flat(), [paginas]);
  const actievePagina = paginas[paginaIndex] ?? [];
  const zichtbaar = useMemo(
    () => filterEnSorteerBagPanden(actievePagina, filters),
    [actievePagina, filters],
  );
  const nummerPerPand = useMemo(
    () => new Map(zichtbaar.map((pand, index) => [pand.bagPandId, paginaIndex * PAGE_SIZE + index + 1])),
    [paginaIndex, zichtbaar],
  );
  const straatgroepen = useMemo(() => {
    const groepen = new Map<string, BagVerkennerPand[]>();
    zichtbaar.forEach((pand) => {
      const straat = pand.straat ?? 'Straat onbekend';
      groepen.set(straat, [...(groepen.get(straat) ?? []), pand]);
    });
    return [...groepen.entries()];
  }, [zichtbaar]);

  const kaartFilters = useMemo<BagKaartFilters>(() => ({
    bouwjaarVan: optioneelGetal(serverFilters.bouwjaarVan),
    bouwjaarTot: optioneelGetal(serverFilters.bouwjaarTot),
    statussen: serverFilters.statussen,
    wijkCodes: serverFilters.wijkCodes,
    buurtCodes: serverFilters.buurtCodes,
    vboOppervlakteSomVan: optioneelGetal(serverFilters.vboSomVan),
    vboOppervlakteSomTot: optioneelGetal(serverFilters.vboSomTot),
    vboOppervlakteMaxVan: optioneelGetal(serverFilters.vboMaxVan),
    vboOppervlakteMaxTot: optioneelGetal(serverFilters.vboMaxTot),
    vboAantalVan: optioneelGetal(serverFilters.vboAantalVan),
    vboAantalTot: optioneelGetal(serverFilters.vboAantalTot),
    gebruiksdoelen: filters.gebruiksdoelen,
    isGemengd: filters.alleenGemengd ? true : null,
    vboModus: serverFilters.vboModus,
  }), [serverFilters, filters.gebruiksdoelen, filters.alleenGemengd]);

  const context = { bestaandeBagIds, bestaandeAdresSleutels, maximaalAantal: 250 };
  const isGeblokkeerd = (pand: BagVerkennerPand) => blokkadeVoorPand(pand, context) !== null;

  const scrollNaarResultaten = () => {
    requestAnimationFrame(() => resultatenTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const laad = async (opnieuw = false) => {
    setLaden(true);
    try {
      const resultaat = await zoekPandenViaServiceV4<BagServicePandV2Rij>({
        scopeCode,
        naIdentificatie: opnieuw ? null : cursor,
        limiet: PAGE_SIZE,
        bouwjaarVan: optioneelGetal(serverFilters.bouwjaarVan),
        bouwjaarTot: optioneelGetal(serverFilters.bouwjaarTot),
        statussen: serverFilters.statussen,
        wijkCodes: serverFilters.wijkCodes,
        buurtCodes: serverFilters.buurtCodes,
        vboOppervlakteSomVan: optioneelGetal(serverFilters.vboSomVan),
        vboOppervlakteSomTot: optioneelGetal(serverFilters.vboSomTot),
        vboOppervlakteMaxVan: optioneelGetal(serverFilters.vboMaxVan),
        vboOppervlakteMaxTot: optioneelGetal(serverFilters.vboMaxTot),
        vboAantalVan: optioneelGetal(serverFilters.vboAantalVan),
        vboAantalTot: optioneelGetal(serverFilters.vboAantalTot),
        gebruiksdoelen: filters.gebruiksdoelen,
        isGemengd: filters.alleenGemengd ? true : null,
        vboModus: serverFilters.vboModus,
      });
      const nieuw = resultaat.rows.map(normaliseerBagServicePandV2);
      if (!nieuw.length) {
        if (opnieuw) {
          setPaginas([]);
          setPaginaIndex(0);
          setCursor(null);
          setGeselecteerd(new Set());
        }
        setHeeftVolgende(false);
        toast.info('Geen BAG-panden gevonden voor deze zoekopdracht.');
        return;
      }

      if (opnieuw) {
        setPaginas([nieuw]);
        setPaginaIndex(0);
        setGeselecteerd(new Set());
      } else {
        const nieuwePaginaIndex = paginas.length;
        setPaginas(previous => [...previous, nieuw]);
        setPaginaIndex(nieuwePaginaIndex);
      }
      setPreflight(null);
      setCursor(nieuw.at(-1)?.cursor ?? null);
      setHeeftVolgende(nieuw.length === PAGE_SIZE);
      scrollNaarResultaten();
    } catch (error) {
      if (opnieuw) {
        setPaginas([]);
        setPaginaIndex(0);
        setCursor(null);
        setHeeftVolgende(true);
        setGeselecteerd(new Set());
      }
      toast.error(error instanceof Error ? error.message : 'BAG-lijst laden mislukt.');
    } finally {
      setLaden(false);
    }
  };

  const gaNaarPagina = (volgendeIndex: number) => {
    if (volgendeIndex < 0 || volgendeIndex >= paginas.length) return;
    setPaginaIndex(volgendeIndex);
    setPreflight(null);
    scrollNaarResultaten();
  };

  const gaNaarVolgende = () => {
    if (paginaIndex < paginas.length - 1) {
      gaNaarPagina(paginaIndex + 1);
      return;
    }
    if (heeftVolgende) void laad(false);
  };

  const toggleFunctie = (functie: string) => setFilters(previous => ({
    ...previous,
    gebruiksdoelen: previous.gebruiksdoelen.includes(functie)
      ? previous.gebruiksdoelen.filter(item => item !== functie)
      : [...previous.gebruiksdoelen, functie],
  }));

  const toggleStatus = (status: string) => setServerFilters(previous => ({
    ...previous,
    statussen: previous.statussen.includes(status)
      ? previous.statussen.filter(item => item !== status)
      : [...previous.statussen, status],
  }));

  const resetZoekfilters = () => {
    setServerFilters({ ...LEGE_SERVER_FILTERS, statussen: [] });
    setFilters(previous => ({ ...previous, gebruiksdoelen: [], alleenGemengd: false }));
    setPaginas([]);
    setPaginaIndex(0);
    setCursor(null);
    setHeeftVolgende(true);
    setGeselecteerd(new Set());
    setPreflight(null);
  };

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
        Pagina {paginaIndex + 1} · nummers {paginaIndex * PAGE_SIZE + 1}–{paginaIndex * PAGE_SIZE + actievePagina.length}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={laden || paginaIndex === 0} onClick={() => gaNaarPagina(paginaIndex - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" />Vorige
        </Button>
        <Badge variant="outline">Pagina {paginaIndex + 1}</Badge>
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
          <div className="flex items-center gap-2"><Database className="h-4 w-4"/><h2 className="text-sm font-medium">Private BAG-Pandenverkenner 2.0</h2><Badge variant="outline">Scope {scopeCode}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">Server-side zoeken in de actieve BAG-index met bouwjaar, status, GBO, grootste VBO, aantal VBO’s en gebruiksfunctie.</p>
        </div>
        {weergave === 'zoeken' && <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={resetZoekfilters} disabled={laden}>Wis zoekfilters</Button>
          <Button onClick={() => laad(true)} disabled={laden}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}Zoeken</Button>
        </div>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border bg-muted/20 p-1">
        <Button type="button" variant={weergave === 'zoeken' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('zoeken')}>
          <Search className="mr-2 h-4 w-4" />Zoeken & lijst
        </Button>
        <Button type="button" variant={weergave === 'kaart' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('kaart')}>
          <MapPinned className="mr-2 h-4 w-4" />Kaart
        </Button>
      </div>

      {weergave === 'zoeken' && <>
      <div className="mt-4"><BagScopeStatus actieveScopeCode={scopeCode} /></div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input inputMode="numeric" value={serverFilters.bouwjaarVan} onChange={event => setServerFilters(previous => ({ ...previous, bouwjaarVan: event.target.value }))} placeholder="Bouwjaar vanaf" />
        <Input inputMode="numeric" value={serverFilters.bouwjaarTot} onChange={event => setServerFilters(previous => ({ ...previous, bouwjaarTot: event.target.value }))} placeholder="Bouwjaar t/m" />
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={serverFilters.vboModus} onChange={event => setServerFilters(previous => ({ ...previous, vboModus: event.target.value as ServerFilters['vboModus'] }))}>
          <option value="alle">Alle panden</option>
          <option value="met_vbo">Alleen met VBO</option>
          <option value="zonder_vbo">Alleen zonder VBO</option>
        </select>
        <label className="flex items-center gap-2 rounded-md border px-3 text-xs"><Checkbox checked={filters.alleenGemengd} onCheckedChange={value => setFilters(previous => ({ ...previous, alleenGemengd: Boolean(value) }))}/>Alleen gemengd</label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/10 p-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium">Meer filters</p>
          <p className="text-[11px] text-muted-foreground">Pandstatus, wijk/buurt, GBO/VBO en gebruiksfunctie.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setToonMeerFilters(value => !value)} aria-expanded={toonMeerFilters}>
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />{toonMeerFilters ? 'Minder' : 'Meer'}
        </Button>
      </div>

      {toonMeerFilters && <>
      <div className="mt-3">
        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-medium">Pandstatus</span>{serverFilters.statussen.length > 0 && <Badge variant="secondary">{serverFilters.statussen.length} geselecteerd</Badge>}</div>
        <div className="flex flex-wrap gap-2">{PANDSTATUSSEN.map(status => <label key={status} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={serverFilters.statussen.includes(status)} onCheckedChange={() => toggleStatus(status)}/>{status}</label>)}</div>
      </div>

      <BagGebiedsfilters
        opties={gebiedsopties}
        wijkCodes={serverFilters.wijkCodes}
        buurtCodes={serverFilters.buurtCodes}
        onWijkCodesChange={wijkCodes => setServerFilters(previous => ({ ...previous, wijkCodes }))}
        onBuurtCodesChange={buurtCodes => setServerFilters(previous => ({ ...previous, buurtCodes }))}
        laden={gebiedenLaden}
      />

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Input inputMode="decimal" value={serverFilters.vboSomVan} onChange={event => setServerFilters(previous => ({ ...previous, vboSomVan: event.target.value }))} placeholder="GBO totaal vanaf" />
        <Input inputMode="decimal" value={serverFilters.vboSomTot} onChange={event => setServerFilters(previous => ({ ...previous, vboSomTot: event.target.value }))} placeholder="GBO totaal t/m" />
        <Input inputMode="decimal" value={serverFilters.vboMaxVan} onChange={event => setServerFilters(previous => ({ ...previous, vboMaxVan: event.target.value }))} placeholder="Grootste VBO vanaf" />
        <Input inputMode="decimal" value={serverFilters.vboMaxTot} onChange={event => setServerFilters(previous => ({ ...previous, vboMaxTot: event.target.value }))} placeholder="Grootste VBO t/m" />
        <Input inputMode="numeric" value={serverFilters.vboAantalVan} onChange={event => setServerFilters(previous => ({ ...previous, vboAantalVan: event.target.value }))} placeholder="Aantal VBO vanaf" />
        <Input inputMode="numeric" value={serverFilters.vboAantalTot} onChange={event => setServerFilters(previous => ({ ...previous, vboAantalTot: event.target.value }))} placeholder="Aantal VBO t/m" />
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-medium">Gebruiksfunctie</span>{filters.gebruiksdoelen.length > 0 && <Badge variant="secondary">{filters.gebruiksdoelen.length} geselecteerd</Badge>}</div>
        <div className="flex flex-wrap gap-2">{FUNCTIES.map(functie => <label key={functie} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={filters.gebruiksdoelen.includes(functie)} onCheckedChange={() => toggleFunctie(functie)}/>{functie}</label>)}</div>
      </div>
      </>}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">
        <Input value={filters.zoekterm} onChange={event => setFilters(previous => ({ ...previous, zoekterm: event.target.value }))} placeholder="Filter geladen pagina lokaal op adres, wijk, buurt, postcode of BAG-ID" />
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.sortering} onChange={event => setFilters(previous => ({ ...previous, sortering: event.target.value as BagVerkennerFilters['sortering'] }))} aria-label="Sorteer geladen pagina">
          <option value="identificatie">Sortering: BAG-ID</option>
          <option value="adres_az">Adres A–Z</option>
          <option value="adres_za">Adres Z–A</option>
          <option value="bouwjaar_oud_nieuw">Bouwjaar oud → nieuw</option>
          <option value="bouwjaar_nieuw_oud">Bouwjaar nieuw → oud</option>
          <option value="gbo_groot_klein">GBO groot → klein</option>
          <option value="gbo_klein_groot">GBO klein → groot</option>
          <option value="vbo_aantal_hoog_laag">Aantal VBO hoog → laag</option>
          <option value="vbo_aantal_laag_hoog">Aantal VBO laag → hoog</option>
        </select>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Binnen Pandstatus, Wijk, Buurt en Gebruiksfunctie geldt OF; tussen verschillende filtergroepen geldt EN. Sortering geldt nu voor de geladen pagina. Bij wijziging van een zoekfilter worden oude resultaten gewist; klik daarna opnieuw op Zoeken.</p>
      </>}
    </div>

    {weergave === 'kaart' && <BagPandenKaart scopeCode={scopeCode} filters={kaartFilters} />}

    <div className={weergave === 'zoeken' ? 'block' : 'hidden'}>
    <div ref={resultatenTopRef} />
    {paginering}
    {panden.length>0 && <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{geselecteerd.size} geselecteerd over {paginas.length} geladen pagina{paginas.length === 1 ? '' : '’s'}; selectie blijft lokaal tot de preflight.</p><div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap"><Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => selecteerPanden(zichtbaar)}>Selecteer zichtbare pagina</Button><Button className="w-full sm:w-auto" variant="outline" size="sm" disabled={!geselecteerd.size} onClick={() => { setGeselecteerd(new Set()); setPreflight(null); }}>Wis selectie</Button><Button className="w-full sm:w-auto" size="sm" disabled={!geselecteerd.size} onClick={() => setPreflight(beoordeelBagSelectie(panden, geselecteerd, context))}><CheckCircle2 className="mr-2 h-4 w-4"/>Controleer selectie</Button></div></div>}
    {preflight && <div className={`border-t p-4 text-sm ${preflight.toegestaan ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{preflight.toegestaan ? 'Selectie technisch gereed voor handmatige promotie' : 'Selectie geblokkeerd'}</p><p className="mt-1 text-xs text-muted-foreground">{preflight.geselecteerd} gecontroleerd · {preflight.kandidaten.length} kandidaat · {preflight.blokkades.length} blokkade(s). Er is niets opgeslagen.</p></div>{preflight.toegestaan&&<Button size="sm" onClick={() => setPromotieOpen(true)}>Handmatig toevoegen…</Button>}</div>{preflight.blokkades.length>0&&<ul className="mt-2 list-disc pl-5 text-xs">{preflight.blokkades.map(item=><li key={`${item.bagPandId}:${item.reden}`}>{item.bagPandId}: {REDEN_LABEL[item.reden]}</li>)}</ul>}</div>}

    {!panden.length ? <div className="p-10 text-center text-sm text-muted-foreground">Stel eventueel zoekfilters in en start een zoekopdracht in de actieve BAG-index.</div> : <div className="divide-y">{straatgroepen.map(([straat, straatPanden]) => {
      const status = bepaalStraatSelectieStatus(straatPanden, geselecteerd, isGeblokkeerd);
      return <div key={straat} className={status.geselecteerd > 0 ? 'bg-primary/[0.02]' : undefined}>
        <div className="flex items-center justify-between gap-3 bg-muted/25 px-4 py-2">
          <div><p className="text-sm font-medium">{straat}</p><p className="text-xs text-muted-foreground">{status.geselecteerd} van {status.beschikbaar} selecteerbaar geselecteerd{straatPanden.length > status.beschikbaar ? ` · ${straatPanden.length - status.beschikbaar} al bekend/geblokkeerd` : ''}</p></div>
          <Button size="sm" variant={status.allesGeselecteerd ? 'secondary' : 'outline'} disabled={status.beschikbaar === 0} onClick={() => toggleStraat(straatPanden)}>{status.allesGeselecteerd ? 'Deselecteer straat' : status.gedeeltelijkGeselecteerd ? 'Selecteer resterende' : 'Selecteer straat'}</Button>
        </div>
        <div className="divide-y">{straatPanden.map(pand => {
          const blokkade = blokkadeVoorPand(pand, context);
          const isGeselecteerd = geselecteerd.has(pand.bagPandId);
          return <div key={`${pand.datasetversieId}:${pand.bagPandId}:${pand.voorkomenSleutel}`} className={`flex items-start gap-3 p-4 ${isGeselecteerd ? 'bg-primary/[0.04]' : ''}`}>
            <div className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full border bg-background px-1 text-[11px] font-medium text-muted-foreground" aria-label={`Volgnummer ${nummerPerPand.get(pand.bagPandId)}`}>{nummerPerPand.get(pand.bagPandId)}</div>
            <Checkbox className="mt-1" disabled={blokkade !== null} checked={isGeselecteerd} onCheckedChange={() => togglePand(pand)}/>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{pand.adres}</p>{pand.gemengdGebruik&&<Badge>Gemengd</Badge>}{pand.status&&<Badge variant="outline">{pand.status}</Badge>}{blokkade&&<BagCrmMatchBadge pand={pand} fallbackLabel={REDEN_LABEL[blokkade]}/>}</div>
              <p className="mt-1 text-xs text-muted-foreground">{[pand.postcode,pand.plaats,pand.wijkNaam,pand.buurtNaam,pand.bouwjaar?`Bouwjaar ${pand.bouwjaar}`:null,pand.oppervlakte!==null?`${Math.round(pand.oppervlakte)} m² GBO`:null,`${pand.aantalVerblijfsobjecten} VBO${pand.aantalVerblijfsobjecten === 1 ? '' : '’s'}`].filter(Boolean).join(' · ')}</p>
              <div className="mt-2 flex flex-wrap gap-1">{pand.gebruiksdoelen.map(doel => <Badge key={doel} variant="secondary" className="text-[10px]">{doel}</Badge>)}</div>
              <p className="mt-2 font-mono-data text-[11px] text-muted-foreground">BAG-pand {pand.bagPandId}</p>
            </div>
            {pand.adresCompleet && <a className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" href={bouwGoogleMapsAdresUrl({ adres: pand.adres, postcode: pand.postcode, plaats: pand.plaats })} target="_blank" rel="noreferrer" aria-label={`Open ${pand.adres} in Google Maps`} title="Open adres in Google Maps"><MapPin className="h-4 w-4"/></a>}
          </div>;
        })}</div>
      </div>;
    })}</div>}

    {panden.length>0 && <div className="border-t">{paginering}<div className="px-4 py-3 text-xs text-muted-foreground">{zichtbaar.length} zichtbaar op deze pagina · {panden.length} panden verdeeld over {paginas.length} geladen pagina{paginas.length === 1 ? '' : '’s'}</div></div>}
    </div>
    {toonNaarBoven && <Button className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg" size="icon" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Naar boven" title="Naar boven"><ArrowUp className="h-4 w-4" /></Button>}
    <BagHandmatigePromotieDialog open={promotieOpen} aantal={preflight?.kandidaten.length ?? 0} bezig={promotieBezig} onOpenChange={setPromotieOpen} onConfirm={promoveer}/>
  </section>;
}
