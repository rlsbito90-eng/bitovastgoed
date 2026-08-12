import fs from 'node:fs';

const lijstPath = 'src/components/bag/BagServicePandenlijst.tsx';
let lijst = fs.readFileSync(lijstPath, 'utf8');
const kaartFlowOld = `    {weergave === 'kaart' && <>
      <BagPandenKaart scopeCode={scopeCode} filters={kaartFilters} geselecteerdeIds={geselecteerd} onKandidaatToggle={toggleKaartKandidaat} />
      {geselecteerd.size > 0 && <div className="flex items-center justify-between gap-3 border-b bg-muted/10 px-4 py-3 text-sm"><span>{geselecteerd.size} kandidaat{geselecteerd.size === 1 ? '' : 'panden'} geselecteerd</span><Button size="sm" onClick={() => setPreflight(beoordeelBagSelectie(selectiePanden, geselecteerd, context))}><CheckCircle2 className="mr-1.5 h-4 w-4" />Controleer selectie</Button></div>}
    </>}`;
const kaartFlowNew = `    {weergave === 'kaart' && <>
      <BagPandenKaart scopeCode={scopeCode} filters={kaartFilters} geselecteerdeIds={geselecteerd} onKandidaatToggle={toggleKaartKandidaat} />
      {geselecteerd.size > 0 && <div className="flex items-center justify-between gap-3 border-b bg-muted/10 px-4 py-3 text-sm"><span>{geselecteerd.size} kandidaat{geselecteerd.size === 1 ? '' : 'panden'} geselecteerd</span><Button size="sm" onClick={() => setPreflight(beoordeelBagSelectie(selectiePanden, geselecteerd, context))}><CheckCircle2 className="mr-1.5 h-4 w-4" />Controleer selectie</Button></div>}
      {preflight && <div className={\`border-b p-4 text-sm \${preflight.toegestaan ? 'bg-emerald-500/5' : 'bg-amber-500/5'}\`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{preflight.toegestaan ? 'Selectie technisch gereed voor handmatige promotie' : 'Selectie geblokkeerd'}</p><p className="mt-1 text-xs text-muted-foreground">{preflight.geselecteerd} gecontroleerd · {preflight.kandidaten.length} kandidaat · {preflight.blokkades.length} blokkade(s). Er is niets opgeslagen.</p></div>{preflight.toegestaan&&<Button size="sm" onClick={() => setPromotieOpen(true)}>Handmatig toevoegen…</Button>}</div>{preflight.blokkades.length>0&&<ul className="mt-2 list-disc pl-5 text-xs">{preflight.blokkades.map(item=><li key={\`\${item.bagPandId}:\${item.reden}\`}>{item.bagPandId}: {REDEN_LABEL[item.reden]}</li>)}</ul>}</div>}
    </>}`;
if (!lijst.includes(kaartFlowOld)) throw new Error('kaart flow target not found');
lijst = lijst.replace(kaartFlowOld, kaartFlowNew);
fs.writeFileSync(lijstPath, lijst);

const kaartPath = 'src/components/bag/BagPandenKaart.tsx';
let kaart = fs.readFileSync(kaartPath, 'utf8');
kaart = kaart.replace(
  `  const mapRef = useRef<MapRef | null>(null);\n`,
  `  const mapRef = useRef<MapRef | null>(null);\n  const focusBewegingRef = useRef(false);\n`,
);
const focusTarget = `      setGeselecteerd({
        id: String(properties.id),
        adres: String(properties.adres ?? ''),
        postcode: String(properties.postcode ?? ''),
        plaats: String(properties.plaats ?? ''),
        status: String(properties.status ?? ''),
        bouwjaar: properties.bouwjaar == null ? null : Number(properties.bouwjaar),
        gbo: properties.gbo == null ? null : Number(properties.gbo),
        vboAantal: properties.vboAantal == null ? null : Number(properties.vboAantal),
        wijk: String(properties.wijk ?? ''),
        buurt: String(properties.buurt ?? ''),
      });`;
if (!kaart.includes(focusTarget)) throw new Error('pand focus target not found');
kaart = kaart.replace(focusTarget, `${focusTarget}
      if (feature.geometry.type === 'Point') {
        const map = mapRef.current?.getMap();
        if (map) {
          focusBewegingRef.current = true;
          map.easeTo({
            center: (feature.geometry as Point).coordinates as [number, number],
            zoom: Math.max(map.getZoom(), 16),
            offset: [0, 110],
            duration: 420,
          });
        }
      }`);
kaart = kaart.replace(
  `          onMoveEnd={() => { if (heeftGezocht) setKaartVerouderd(true); }}`,
  `          onMoveEnd={() => { if (focusBewegingRef.current) { focusBewegingRef.current = false; return; } if (heeftGezocht) setKaartVerouderd(true); }}`,
);
kaart = kaart.replace(
  `              maxWidth="320px"\n              offset={10}`,
  `              maxWidth="320px"\n              anchor="bottom"\n              offset={12}`,
);
fs.writeFileSync(kaartPath, kaart);

const testPath = 'src/test/bag/pandenverkennerKaartWorkflowFocus.test.ts';
fs.writeFileSync(testPath, `import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const kaart = fs.readFileSync('src/components/bag/BagPandenKaart.tsx', 'utf8');

describe('Pandenverkenner kaartworkflow en focus', () => {
  it('toont preflight en vervolgactie ook binnen de kaartweergave', () => {
    const kaartStart = lijst.indexOf("{weergave === 'kaart' && <>");
    const lijstStart = lijst.indexOf("<div className={weergave === 'zoeken' ? 'block' : 'hidden'}>");
    const kaartBlok = lijst.slice(kaartStart, lijstStart);
    expect(kaartBlok).toContain('Controleer selectie');
    expect(kaartBlok).toContain('Selectie technisch gereed voor handmatige promotie');
    expect(kaartBlok).toContain('Handmatig toevoegen…');
  });

  it('centreert een aangeklikt pand met ruimte voor de popup zonder kaartdata stale te markeren', () => {
    expect(kaart).toContain('focusBewegingRef.current = true');
    expect(kaart).toContain('zoom: Math.max(map.getZoom(), 16)');
    expect(kaart).toContain('offset: [0, 110]');
    expect(kaart).toContain('anchor="bottom"');
    expect(kaart).toContain('if (focusBewegingRef.current) { focusBewegingRef.current = false; return; }');
  });
});
`);
