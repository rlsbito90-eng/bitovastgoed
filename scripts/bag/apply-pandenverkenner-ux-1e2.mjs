import fs from 'node:fs';

function vervangEen(tekst, van, naar, label) {
  const aantal = tekst.split(van).length - 1;
  if (aantal !== 1) throw new Error(`${label}: verwacht exact 1 match, kreeg ${aantal}`);
  return tekst.replace(van, naar);
}

const bagPad = 'src/components/bag/BagServicePandenlijst.tsx';
let bag = fs.readFileSync(bagPad, 'utf8');

bag = vervangEen(
  bag,
  `  Loader2,\n  MapPin,\n  Search,`,
  `  Loader2,\n  MapPin,\n  MapPinned,\n  Search,\n  SlidersHorizontal,`,
  'icons',
);

bag = vervangEen(
  bag,
  `  const [gebiedsopties, setGebiedsopties] = useState<BagCbsGebiedsoptie[]>([]);\n  const [gebiedenLaden, setGebiedenLaden] = useState(false);`,
  `  const [gebiedsopties, setGebiedsopties] = useState<BagCbsGebiedsoptie[]>([]);\n  const [gebiedenLaden, setGebiedenLaden] = useState(false);\n  const [weergave, setWeergave] = useState<'zoeken' | 'kaart'>('zoeken');\n  const [toonMeerFilters, setToonMeerFilters] = useState(false);`,
  'view-state',
);

bag = vervangEen(
  bag,
  `        <div className="flex flex-wrap gap-2">\n          <Button variant="outline" onClick={resetZoekfilters} disabled={laden}>Wis zoekfilters</Button>\n          <Button onClick={() => laad(true)} disabled={laden}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}Zoeken</Button>\n        </div>`,
  `        {weergave === 'zoeken' && <div className="flex flex-wrap gap-2">\n          <Button variant="outline" onClick={resetZoekfilters} disabled={laden}>Wis zoekfilters</Button>\n          <Button onClick={() => laad(true)} disabled={laden}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}Zoeken</Button>\n        </div>}`,
  'header-actions',
);

bag = vervangEen(
  bag,
  `      </div>\n      <div className="mt-4"><BagScopeStatus actieveScopeCode={scopeCode} /></div>`,
  `      </div>\n\n      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border bg-muted/20 p-1">\n        <Button type="button" variant={weergave === 'zoeken' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('zoeken')}>\n          <Search className="mr-2 h-4 w-4" />Zoeken & lijst\n        </Button>\n        <Button type="button" variant={weergave === 'kaart' ? 'secondary' : 'ghost'} className="w-full justify-center" onClick={() => setWeergave('kaart')}>\n          <MapPinned className="mr-2 h-4 w-4" />Kaart\n        </Button>\n      </div>\n\n      {weergave === 'zoeken' && <>\n      <div className="mt-4"><BagScopeStatus actieveScopeCode={scopeCode} /></div>`,
  'tabs-open',
);

bag = vervangEen(
  bag,
  `      <div className="mt-3">\n        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-medium">Pandstatus</span>{serverFilters.statussen.length > 0 && <Badge variant="secondary">{serverFilters.statussen.length} geselecteerd</Badge>}</div>`,
  `      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/10 p-2.5">\n        <div className="min-w-0">\n          <p className="text-xs font-medium">Meer filters</p>\n          <p className="text-[11px] text-muted-foreground">Pandstatus, wijk/buurt, GBO/VBO en gebruiksfunctie.</p>\n        </div>\n        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setToonMeerFilters(value => !value)} aria-expanded={toonMeerFilters}>\n          <SlidersHorizontal className="mr-1.5 h-4 w-4" />{toonMeerFilters ? 'Minder' : 'Meer'}\n        </Button>\n      </div>\n\n      {toonMeerFilters && <>\n      <div className="mt-3">\n        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-medium">Pandstatus</span>{serverFilters.statussen.length > 0 && <Badge variant="secondary">{serverFilters.statussen.length} geselecteerd</Badge>}</div>`,
  'advanced-open',
);

bag = vervangEen(
  bag,
  `      <div className="mt-3">\n        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-medium">Gebruiksfunctie</span>{filters.gebruiksdoelen.length > 0 && <Badge variant="secondary">{filters.gebruiksdoelen.length} geselecteerd</Badge>}</div>\n        <div className="flex flex-wrap gap-2">{FUNCTIES.map(functie => <label key={functie} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={filters.gebruiksdoelen.includes(functie)} onCheckedChange={() => toggleFunctie(functie)}/>{functie}</label>)}</div>\n      </div>\n\n      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">`,
  `      <div className="mt-3">\n        <div className="mb-2 flex items-center gap-2"><span className="text-xs font-medium">Gebruiksfunctie</span>{filters.gebruiksdoelen.length > 0 && <Badge variant="secondary">{filters.gebruiksdoelen.length} geselecteerd</Badge>}</div>\n        <div className="flex flex-wrap gap-2">{FUNCTIES.map(functie => <label key={functie} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={filters.gebruiksdoelen.includes(functie)} onCheckedChange={() => toggleFunctie(functie)}/>{functie}</label>)}</div>\n      </div>\n      </>}\n\n      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">`,
  'advanced-close',
);

bag = vervangEen(
  bag,
  `      <p className="mt-2 text-[11px] text-muted-foreground">Binnen Pandstatus, Wijk, Buurt en Gebruiksfunctie geldt OF; tussen verschillende filtergroepen geldt EN. Sortering geldt nu voor de geladen pagina. Bij wijziging van een zoekfilter worden oude resultaten gewist; klik daarna opnieuw op Zoeken.</p>\n    </div>\n\n    <BagPandenKaart scopeCode={scopeCode} filters={kaartFilters} />\n\n    <div ref={resultatenTopRef} />`,
  `      <p className="mt-2 text-[11px] text-muted-foreground">Binnen Pandstatus, Wijk, Buurt en Gebruiksfunctie geldt OF; tussen verschillende filtergroepen geldt EN. Sortering geldt nu voor de geladen pagina. Bij wijziging van een zoekfilter worden oude resultaten gewist; klik daarna opnieuw op Zoeken.</p>\n      </>}\n    </div>\n\n    {weergave === 'kaart' && <BagPandenKaart scopeCode={scopeCode} filters={kaartFilters} />}\n\n    <div className={weergave === 'zoeken' ? 'block' : 'hidden'}>\n    <div ref={resultatenTopRef} />`,
  'search-map-split',
);

bag = vervangEen(
  bag,
  `    {toonNaarBoven && <Button className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg" size="icon" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Naar boven" title="Naar boven"><ArrowUp className="h-4 w-4" /></Button>}`,
  `    </div>\n    {toonNaarBoven && <Button className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg" size="icon" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Naar boven" title="Naar boven"><ArrowUp className="h-4 w-4" /></Button>}`,
  'results-close',
);

fs.writeFileSync(bagPad, bag);

const kansenPad = 'src/pages/VastgoedkansenPage.tsx';
let kansen = fs.readFileSync(kansenPad, 'utf8');
kansen = vervangEen(
  kansen,
  `actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/vastgoedkansen/vinden"><Radar className="mr-1.5 h-4 w-4" />Panden vinden</Link></Button><Button onClick={() => setForm({ open: true, kans: null })}><Plus className="mr-1.5 h-4 w-4" />Nieuwe kans</Button></div>}`,
  `actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setForm({ open: true, kans: null })}><Plus className="mr-1.5 h-4 w-4" />Nieuwe kans</Button><Button asChild><Link to="/vastgoedkansen/vinden"><Radar className="mr-1.5 h-4 w-4" />Panden vinden</Link></Button></div>}`,
  'vastgoedkansen-actions',
);
fs.writeFileSync(kansenPad, kansen);

console.log('Pandenverkenner 1E.2 UX-patch toegepast.');
