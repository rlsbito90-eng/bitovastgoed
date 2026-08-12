import fs from 'node:fs';

function replaceExact(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Patroon niet gevonden in ${path}: ${from.slice(0,120)}`);
  fs.writeFileSync(path, source.replace(from, to));
}

const lijst = 'src/components/bag/BagServicePandenlijst.tsx';
replaceExact(lijst,
`import {
  bewaarWerkcontext, bewaarZoekprofielen, leesWerkcontext, leesZoekprofielen, maakZoekprofiel,
  type BagPersistenteServerFilters, type BagZoekprofiel,
} from '@/lib/bag/pandenverkennerPersistence';`,
`import {
  bewaarWerkcontext, leesLokaleZoekprofielen, leesWerkcontext, wisLokaleZoekprofielen,
  type BagPersistenteServerFilters, type BagZoekprofiel,
} from '@/lib/bag/pandenverkennerPersistence';
import {
  haalAccountZoekprofielen,
  importeerLokaleZoekprofielen,
  maakAccountZoekprofiel,
  verwijderAccountZoekprofiel,
  werkAccountZoekprofielBij,
} from '@/lib/bag/zoekprofielenRepository';`);

replaceExact(lijst,
`  const [zoekprofielen, setZoekprofielen] = useState<BagZoekprofiel[]>(() => leesZoekprofielen(scopeCode));
  const [profielNaam, setProfielNaam] = useState('');`,
`  const [zoekprofielen, setZoekprofielen] = useState<BagZoekprofiel[]>([]);
  const [profielenLaden, setProfielenLaden] = useState(false);
  const [profielActieBezig, setProfielActieBezig] = useState(false);
  const [actiefProfielId, setActiefProfielId] = useState<string | null>(null);
  const [profielNaam, setProfielNaam] = useState('');`);

replaceExact(lijst,
`  useEffect(() => {
    bewaarWerkcontext({ scopeCode, serverFilters, filters, weergave, toonMeerFilters });
  }, [scopeCode, serverFilters, filters, weergave, toonMeerFilters]);`,
`  useEffect(() => {
    let actief = true;
    setProfielenLaden(true);
    void (async () => {
      const lokaal = leesLokaleZoekprofielen(scopeCode);
      if (lokaal.length) {
        await importeerLokaleZoekprofielen(lokaal);
        wisLokaleZoekprofielen(scopeCode);
      }
      const remote = await haalAccountZoekprofielen(scopeCode);
      if (actief) setZoekprofielen(remote);
    })()
      .catch(error => { if (actief) toast.error(error instanceof Error ? error.message : 'Opgeslagen zoekopdrachten laden mislukt.'); })
      .finally(() => { if (actief) setProfielenLaden(false); });
    return () => { actief = false; };
  }, [scopeCode]);

  useEffect(() => {
    if (weergave !== 'opgeslagen') return;
    let actief = true;
    setProfielenLaden(true);
    void haalAccountZoekprofielen(scopeCode)
      .then(remote => { if (actief) setZoekprofielen(remote); })
      .catch(error => { if (actief) toast.error(error instanceof Error ? error.message : 'Opgeslagen zoekopdrachten verversen mislukt.'); })
      .finally(() => { if (actief) setProfielenLaden(false); });
    return () => { actief = false; };
  }, [scopeCode, weergave]);

  useEffect(() => {
    bewaarWerkcontext({ scopeCode, serverFilters, filters, weergave, toonMeerFilters });
  }, [scopeCode, serverFilters, filters, weergave, toonMeerFilters]);`);

replaceExact(lijst,
`  const slaZoekprofielOp = () => {
    const naam = profielNaam.trim();
    if (!naam) return toast.error('Geef de zoekopdracht eerst een naam.');
    const profiel = maakZoekprofiel({ naam, scopeCode, serverFilters, filters });
    const next = [profiel, ...zoekprofielen];
    setZoekprofielen(next);
    bewaarZoekprofielen(scopeCode, next);
    setProfielNaam('');
    toast.success('Zoekopdracht opgeslagen op dit apparaat.');
  };

  const openZoekprofiel = (profiel: BagZoekprofiel) => {
    setServerFilters(profiel.serverFilters);
    setFilters(profiel.filters);
    setToonMeerFilters(true);
    setWeergave('zoeken');
    toast.success(\`Zoekopdracht “\${profiel.naam}” geladen.\`);
  };

  const verwijderZoekprofiel = (id: string) => {
    const next = zoekprofielen.filter(profiel => profiel.id !== id);
    setZoekprofielen(next);
    bewaarZoekprofielen(scopeCode, next);
  };`,
`  const slaZoekprofielOp = async () => {
    const naam = profielNaam.trim();
    if (!naam) return toast.error('Geef de zoekopdracht eerst een naam.');
    setProfielActieBezig(true);
    try {
      const profiel = await maakAccountZoekprofiel({ naam, scopeCode, serverFilters, filters });
      setZoekprofielen(previous => [profiel, ...previous.filter(item => item.id !== profiel.id)]);
      setProfielNaam('');
      toast.success('Zoekopdracht opgeslagen in je account.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Zoekopdracht opslaan mislukt.');
    } finally {
      setProfielActieBezig(false);
    }
  };

  const openZoekprofiel = (profiel: BagZoekprofiel, bewerken = false) => {
    setServerFilters(profiel.serverFilters);
    setFilters(profiel.filters);
    setToonMeerFilters(true);
    setActiefProfielId(bewerken ? profiel.id : null);
    setProfielNaam(bewerken ? profiel.naam : '');
    setWeergave('zoeken');
    toast.success(bewerken ? \`Zoekopdracht “\${profiel.naam}” geopend om te wijzigen.\` : \`Zoekopdracht “\${profiel.naam}” geladen.\`);
  };

  const bewaarProfielWijzigingen = async () => {
    if (!actiefProfielId) return;
    const naam = profielNaam.trim();
    if (!naam) return toast.error('Geef de zoekopdracht een naam.');
    setProfielActieBezig(true);
    try {
      const profiel = await werkAccountZoekprofielBij(actiefProfielId, { naam, scopeCode, serverFilters, filters });
      setZoekprofielen(previous => [profiel, ...previous.filter(item => item.id !== profiel.id)]);
      setProfielNaam(profiel.naam);
      toast.success('Wijzigingen opgeslagen.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wijzigingen opslaan mislukt.');
    } finally {
      setProfielActieBezig(false);
    }
  };

  const slaProfielOpAlsNieuw = async () => {
    const naam = profielNaam.trim();
    if (!naam) return toast.error('Geef de nieuwe zoekopdracht een naam.');
    const origineel = zoekprofielen.find(profiel => profiel.id === actiefProfielId);
    const nieuweNaam = origineel?.naam === naam ? \`\${naam} kopie\` : naam;
    setProfielActieBezig(true);
    try {
      const profiel = await maakAccountZoekprofiel({ naam: nieuweNaam, scopeCode, serverFilters, filters });
      setZoekprofielen(previous => [profiel, ...previous]);
      setActiefProfielId(profiel.id);
      setProfielNaam(profiel.naam);
      toast.success(\`Nieuwe zoekopdracht “\${profiel.naam}” opgeslagen.\`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Opslaan als nieuw mislukt.');
    } finally {
      setProfielActieBezig(false);
    }
  };

  const verwijderZoekprofiel = async (id: string) => {
    setProfielActieBezig(true);
    try {
      await verwijderAccountZoekprofiel(id);
      setZoekprofielen(previous => previous.filter(profiel => profiel.id !== id));
      if (actiefProfielId === id) {
        setActiefProfielId(null);
        setProfielNaam('');
      }
      toast.success('Zoekopdracht verwijderd.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Zoekopdracht verwijderen mislukt.');
    } finally {
      setProfielActieBezig(false);
    }
  };`);

replaceExact(lijst,
`      <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg border bg-muted/20 p-1">
        <Button type="button" variant={weergave === 'zoeken' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('zoeken')}>
          <Search className="mr-2 h-4 w-4" />Zoeken
        </Button>
        <Button type="button" variant={weergave === 'kaart' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('kaart')}>
          <MapPinned className="mr-2 h-4 w-4" />Kaart
        </Button>
        <Button type="button" variant={weergave === 'opgeslagen' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('opgeslagen')}>
          Opgeslagen
        </Button>
      </div>`,
`      <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg border bg-muted/20 p-1">
        <Button type="button" variant={weergave === 'zoeken' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('zoeken')}>
          <Search className="mr-2 h-4 w-4" />Zoeken
        </Button>
        <Button type="button" variant={weergave === 'kaart' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('kaart')}>
          <MapPinned className="mr-2 h-4 w-4" />Kaart
        </Button>
        <Button type="button" variant={weergave === 'opgeslagen' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('opgeslagen')}>
          Opgeslagen
        </Button>
      </div>

      {weergave === 'zoeken' && actiefProfielId && <div className="mt-3 rounded-lg border bg-muted/10 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Zoekprofiel wijzigen</p>
            <p className="mb-2 text-[11px] text-muted-foreground">Pas de filters aan en sla de wijzigingen op, of bewaar de huidige variant als nieuw profiel.</p>
            <Input value={profielNaam} onChange={event => setProfielNaam(event.target.value)} placeholder="Naam zoekprofiel" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="sm" onClick={() => void bewaarProfielWijzigingen()} disabled={profielActieBezig}>Wijzigingen opslaan</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void slaProfielOpAlsNieuw()} disabled={profielActieBezig}>Opslaan als nieuw</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setActiefProfielId(null); setProfielNaam(''); }}>Stop wijzigen</Button>
          </div>
        </div>
      </div>}`);

const oldSaved = `    {weergave === 'opgeslagen' && <div className="border-b p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input value={profielNaam} onChange={event => setProfielNaam(event.target.value)} placeholder="Naam van deze zoekopdracht" />
        <Button type="button" onClick={slaZoekprofielOp}>Zoekopdracht opslaan</Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Opgeslagen zoekopdrachten bewaren de filterdefinitie op dit apparaat; resultaten worden bij openen opnieuw actueel opgehaald.</p>
      <div className="mt-4 space-y-2">
        {!zoekprofielen.length && <p className="rounded-md border p-4 text-sm text-muted-foreground">Nog geen opgeslagen zoekopdrachten.</p>}
        {zoekprofielen.map(profiel => <div key={profiel.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{profiel.naam}</p><p className="text-[11px] text-muted-foreground">{new Date(profiel.bijgewerktOp).toLocaleDateString('nl-NL')}</p></div>
          <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => openZoekprofiel(profiel)}>Open</Button><Button size="sm" variant="ghost" onClick={() => verwijderZoekprofiel(profiel.id)}>Verwijder</Button></div>
        </div>)}
      </div>
    </div>}`;
const newSaved = `    {weergave === 'opgeslagen' && <div className="border-b p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input value={actiefProfielId ? '' : profielNaam} disabled={Boolean(actiefProfielId)} onChange={event => setProfielNaam(event.target.value)} placeholder={actiefProfielId ? 'Stop eerst met wijzigen om een nieuw profiel te maken' : 'Naam van deze zoekopdracht'} />
        <Button type="button" onClick={() => void slaZoekprofielOp()} disabled={profielActieBezig || Boolean(actiefProfielId)}>Zoekopdracht opslaan</Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Zoekopdrachten zijn gekoppeld aan je Bito-account en daardoor beschikbaar op je andere apparaten. Alleen de filterdefinitie wordt opgeslagen; resultaten worden steeds opnieuw actueel opgehaald.</p>
      <div className="mt-4 space-y-2">
        {profielenLaden && <p className="rounded-md border p-4 text-sm text-muted-foreground">Opgeslagen zoekopdrachten laden…</p>}
        {!profielenLaden && !zoekprofielen.length && <p className="rounded-md border p-4 text-sm text-muted-foreground">Nog geen opgeslagen zoekopdrachten.</p>}
        {zoekprofielen.map(profiel => <div key={profiel.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{profiel.naam}</p><p className="text-[11px] text-muted-foreground">Laatst gewijzigd {new Date(profiel.bijgewerktOp).toLocaleDateString('nl-NL')}</p></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openZoekprofiel(profiel, false)}>Openen</Button><Button size="sm" variant="outline" onClick={() => openZoekprofiel(profiel, true)}>Wijzigen</Button><Button size="sm" variant="ghost" disabled={profielActieBezig} onClick={() => void verwijderZoekprofiel(profiel.id)}>Verwijder</Button></div>
        </div>)}
      </div>
    </div>}`;
replaceExact(lijst, oldSaved, newSaved);

const kaart = 'src/components/bag/BagPandenKaart.tsx';
replaceExact(kaart, "const CONTOUR_FILL={id:'bag-pandcontour-fill',type:'fill' as const,source:'bag-pandcontouren',minzoom:17", "const CONTOUR_FILL={id:'bag-pandcontour-fill',type:'fill' as const,source:'bag-pandcontouren',minzoom:16.5");
replaceExact(kaart, "const CONTOUR_LINE={id:'bag-pandcontour-line',type:'line' as const,source:'bag-pandcontouren',minzoom:17", "const CONTOUR_LINE={id:'bag-pandcontour-line',type:'line' as const,source:'bag-pandcontouren',minzoom:16.5");
replaceExact(kaart, "const mapRef=useRef<MapRef|null>(null); const focusBewegingRef=useRef(false); const clusterDrilldownRef", "const mapRef=useRef<MapRef|null>(null); const focusBewegingRef=useRef(false); const focusVerversNaMoveRef=useRef(false); const clusterDrilldownRef");
replaceExact(kaart, "focusBewegingRef.current=true;map.easeTo({center:(f.geometry as Point).coordinates as [number,number],zoom:Math.max(map.getZoom(),17),offset:[0,110],duration:420});", "focusBewegingRef.current=true;focusVerversNaMoveRef.current=map.getZoom()<16.5;map.easeTo({center:(f.geometry as Point).coordinates as [number,number],zoom:Math.max(map.getZoom(),16.6),offset:[0,110],duration:420});");
replaceExact(kaart, "if(focusBewegingRef.current){focusBewegingRef.current=false;return;}", "if(focusBewegingRef.current){focusBewegingRef.current=false;if(focusVerversNaMoveRef.current){focusVerversNaMoveRef.current=false;void zoekInKaartgebied();}return;}");
replaceExact(kaart, "vanaf zoomniveau 17 verschijnen BAG-pandcontouren", "vanaf zoomniveau 16,5 verschijnen BAG-pandcontouren");

const sql = 'experiments/bag/pandenverkenner-map-v2.sql';
replaceExact(sql, 'CASE WHEN p_zoom >= 17 THEN', 'CASE WHEN p_zoom >= 16.5 THEN');

const test = 'src/test/bag/pandenverkennerWorkflowPersistence.test.ts';
replaceExact(test,
`const persistence = fs.readFileSync('src/lib/bag/pandenverkennerPersistence.ts', 'utf8');`,
`const persistence = fs.readFileSync('src/lib/bag/pandenverkennerPersistence.ts', 'utf8');
const repository = fs.readFileSync('src/lib/bag/zoekprofielenRepository.ts', 'utf8');
const migratie = fs.readFileSync('supabase/migrations/20260812191000_bag_saved_searches_v2.sql', 'utf8');`);
replaceExact(test,
`  it('biedt expliciet opgeslagen zoekopdrachten zonder resultaten als snapshot vast te zetten', () => {
    expect(persistence).toContain('localStorage');
    expect(lijst).toContain('Zoekopdracht opslaan');
    expect(lijst).toContain('resultaten worden bij openen opnieuw actueel opgehaald');
    expect(lijst).toContain("setWeergave('opgeslagen')");
  });`,
`  it('synchroniseert opgeslagen zoekopdrachten accountgebonden en bewaart geen resultaatsnapshot', () => {
    expect(repository).toContain("from('bag_zoekprofielen')");
    expect(repository).toContain('supabase.auth.getUser()');
    expect(lijst).toContain('gekoppeld aan je Bito-account');
    expect(lijst).toContain('resultaten worden steeds opnieuw actueel opgehaald');
    expect(lijst).toContain('Wijzigingen opslaan');
    expect(lijst).toContain('Opslaan als nieuw');
    expect(migratie).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migratie).toContain('auth.uid() = user_id');
    expect(persistence).toContain('éénmalig naar het account te migreren');
  });`);

const mapTest = 'src/test/bag/pandenverkennerMapV2.test.ts';
let mapTestSource = fs.readFileSync(mapTest, 'utf8');
mapTestSource = mapTestSource.replaceAll('zoomniveau 17', 'zoomniveau 16,5').replaceAll('minzoom:17', 'minzoom:16.5').replaceAll('p_zoom >= 17', 'p_zoom >= 16.5');
fs.writeFileSync(mapTest, mapTestSource);
