import fs from 'node:fs';

function replace(path, from, to, label) {
  const input = fs.readFileSync(path, 'utf8');
  if (!input.includes(from)) {
    if (input.includes(to)) return;
    throw new Error(`Patroon niet gevonden: ${label}`);
  }
  fs.writeFileSync(path, input.replace(from, to));
}

const kaart = 'src/components/bag/BagPandenKaart.tsx';
replace(kaart,
" const mapRef=useRef<MapRef|null>(null); const focusBewegingRef=useRef(false); const filterKey=useMemo(()=>JSON.stringify(filters),[filters]); const initiëleSessie=useRef(leesKaartSessie(scopeCode,filterKey)).current;",
" const mapRef=useRef<MapRef|null>(null); const focusBewegingRef=useRef(false); const clusterDrilldownRef=useRef(false); const verversTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null); const filterKey=useMemo(()=>JSON.stringify(filters),[filters]); const initiëleSessie=useRef(leesKaartSessie(scopeCode,filterKey)).current;",
'kaart refs');
replace(kaart,
" useEffect(()=>{const sessie=leesKaartSessie(scopeCode,filterKey);setRows(sessie?.rows??[]);setHeeftGezocht(sessie?.heeftGezocht??false);setKaartVerouderd(false);setGeselecteerd(null);if(sessie?.viewState)mapRef.current?.jumpTo(sessie.viewState);},[scopeCode,filterKey]);",
" useEffect(()=>{const sessie=leesKaartSessie(scopeCode,filterKey);setRows(sessie?.rows??[]);setHeeftGezocht(sessie?.heeftGezocht??false);setKaartVerouderd(false);setGeselecteerd(null);if(sessie?.viewState)mapRef.current?.jumpTo(sessie.viewState);},[scopeCode,filterKey]);\n useEffect(()=>()=>{if(verversTimerRef.current)clearTimeout(verversTimerRef.current);},[]);",
'kaart timer cleanup');
replace(kaart,
"if(f.layer.id==='bag-server-clusters'&&f.geometry.type==='Point'){focusBewegingRef.current=true;mapRef.current?.easeTo({center:(f.geometry as Point).coordinates as [number,number],zoom:Math.min((mapRef.current?.getZoom()??10)+1.8,15.2),duration:420});return;}",
"if(f.layer.id==='bag-server-clusters'&&f.geometry.type==='Point'){clusterDrilldownRef.current=true;mapRef.current?.easeTo({center:(f.geometry as Point).coordinates as [number,number],zoom:Math.min((mapRef.current?.getZoom()??10)+1.8,15.2),duration:420});return;}",
'cluster drilldown');
replace(kaart,
"},[]);\n const geselecteerdPunt=useMemo",
"},[zoekInKaartgebied]);\n const geselecteerdPunt=useMemo",
'click callback deps');
replace(kaart,
"<p className=\"mt-1 text-xs text-muted-foreground\">Uitgezoomd zie je clusters over alle matches. Vanaf zoomniveau 17 verschijnen BAG-pandcontouren. Verplaats of zoom en kies daarna ‘Zoek in dit gebied’.</p></div><Button onClick={()=>void zoekInKaartgebied()} disabled={laden}>{laden?<Loader2 className=\"mr-2 h-4 w-4 animate-spin\"/>:kaartVerouderd?<RefreshCw className=\"mr-2 h-4 w-4\"/>:<MapPinned className=\"mr-2 h-4 w-4\"/>}Zoek in dit gebied</Button>",
"<p className=\"mt-1 text-xs text-muted-foreground\">Uitgezoomd zie je clusters over alle matches. Tik een cluster aan om automatisch verder in te zoomen. De kaart ververst vanzelf na slepen of zoomen; vanaf zoomniveau 17 verschijnen BAG-pandcontouren.</p></div><Button onClick={()=>void zoekInKaartgebied()} disabled={laden}>{laden?<Loader2 className=\"mr-2 h-4 w-4 animate-spin\"/>:kaartVerouderd?<RefreshCw className=\"mr-2 h-4 w-4\"/>:<MapPinned className=\"mr-2 h-4 w-4\"/>}Ververs kaart</Button>",
'kaart uitleg en fallback');
replace(kaart,
"initialViewState={initiëleSessie?.viewState??AMSTERDAM_VIEWPORT} onMoveEnd={()=>{const map=mapRef.current?.getMap();if(map){const c=map.getCenter();bewaarKaartSessie({scopeCode,filterKey,rows,heeftGezocht,viewState:{longitude:c.lng,latitude:c.lat,zoom:map.getZoom()}});}if(focusBewegingRef.current){focusBewegingRef.current=false;return;}if(heeftGezocht)setKaartVerouderd(true);}} onClick={onClickKaart}",
"initialViewState={initiëleSessie?.viewState??AMSTERDAM_VIEWPORT} onLoad={()=>{if(!heeftGezocht)void zoekInKaartgebied();}} onMoveEnd={()=>{const map=mapRef.current?.getMap();if(map){const c=map.getCenter();bewaarKaartSessie({scopeCode,filterKey,rows,heeftGezocht,viewState:{longitude:c.lng,latitude:c.lat,zoom:map.getZoom()}});}if(clusterDrilldownRef.current){clusterDrilldownRef.current=false;void zoekInKaartgebied();return;}if(focusBewegingRef.current){focusBewegingRef.current=false;return;}if(heeftGezocht){setKaartVerouderd(true);if(verversTimerRef.current)clearTimeout(verversTimerRef.current);verversTimerRef.current=setTimeout(()=>void zoekInKaartgebied(),700);}}} onClick={onClickKaart}",
'auto refresh');
replace(kaart,
"<div className=\"rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm\">Kies ‘Zoek in dit gebied’ om de kaartresultaten te laden.</div>",
"<div className=\"rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm\">Panden worden automatisch voor dit kaartgebied geladen.</div>",
'initial overlay');

const lijst = 'src/components/bag/BagServicePandenlijst.tsx';
replace(lijst,
"  const reviewRef = useRef<HTMLDivElement | null>(null);",
"  const kaartReviewRef = useRef<HTMLDivElement | null>(null);\n  const lijstReviewRef = useRef<HTMLDivElement | null>(null);",
'review refs');
replace(lijst,
"    requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));",
"    const reviewRef = weergave === 'kaart' ? kaartReviewRef : lijstReviewRef;\n    requestAnimationFrame(() => requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })));",
'review scroll target');
replace(lijst,"<Search className=\"mr-2 h-4 w-4\" />Zoeken & lijst","<Search className=\"mr-2 h-4 w-4\" />Zoeken",'tab label');
replace(lijst,"{preflight && <div ref={reviewRef} className=\"scroll-mt-4 border-b\">","{preflight && <div ref={kaartReviewRef} className=\"scroll-mt-24 border-b\">",'kaart review ref');
replace(lijst,"{preflight && <div ref={reviewRef} className=\"scroll-mt-4 border-t\">","{preflight && <div ref={lijstReviewRef} className=\"scroll-mt-24 border-t\">",'lijst review ref');

const ux = 'src/lib/bag/pandenverkennerUx1e2Contract.test.ts';
replace(ux,"expect(pandenverkenner).toContain('Zoeken & lijst');","expect(pandenverkenner).toContain('>Zoeken');",'ux label test');
const ui = 'src/lib/bag/pandenverkennerUiContract.test.ts';
replace(ui,"const preflightIndex = component.indexOf('{preflight && <div ref={reviewRef}');","const preflightIndex = component.indexOf('{preflight && <div ref={lijstReviewRef}');",'ui review index');
replace(ui,"expect(component).toContain(\"reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })\");","expect(component).toContain(\"reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })\");\n    expect(component).toContain(\"weergave === 'kaart' ? kaartReviewRef : lijstReviewRef\");",'ui scroll target');
const hotfix = 'src/test/bag/pandenverkennerKaartFlowHotfix.test.ts';
replace(hotfix,"expect(controleerSelectieBlok).toContain(\"reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })\");","expect(controleerSelectieBlok).toContain(\"weergave === 'kaart' ? kaartReviewRef : lijstReviewRef\");\n    expect(controleerSelectieBlok).toContain(\"reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })\");",'hotfix scroll test');
replace(hotfix,"expect(kaart).toContain('Zoek in dit gebied');","expect(kaart).toContain('Ververs kaart');",'hotfix kaartlabel');
const workflow = 'src/test/bag/pandenverkennerWorkflowPersistence.test.ts';
replace(workflow,"expect(lijst).toContain(\"reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })\");","expect(lijst).toContain(\"weergave === 'kaart' ? kaartReviewRef : lijstReviewRef\");\n    expect(lijst).toContain(\"reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })\");",'workflow scroll test');
const kaartTest = 'src/lib/bag/pandenverkennerKaart1E1.test.ts';
replace(kaartTest,"expect(component).toContain('Zoek in dit gebied');","expect(component).toContain('Ververs kaart');",'kaart label test');
replace(kaartTest,"it('zoekt niet automatisch bij iedere kaartbeweging', () => {","it('ververst gedebounced na kaartbeweging en laat programmatische pandfocus met rust', () => {",'kaart test titel');
replace(kaartTest,"    expect(component).toContain('if(heeftGezocht)setKaartVerouderd(true);');\n    expect(component).not.toContain('onMove={zoekInKaartgebied}');",
"    expect(component).toContain('setTimeout(()=>void zoekInKaartgebied(),700)');\n    expect(component).toContain('clusterDrilldownRef.current');\n    expect(component).not.toContain('onMove={zoekInKaartgebied}');",
'kaart auto refresh test');
const focusTest='src/test/bag/pandenverkennerKaartWorkflowFocus.test.ts';
replace(focusTest,"expect(kaart).toContain('if(focusBewegingRef.current){focusBewegingRef.current=false;return;}');","expect(kaart).toContain('if(focusBewegingRef.current){focusBewegingRef.current=false;return;}');\n    expect(kaart).toContain('if(clusterDrilldownRef.current){clusterDrilldownRef.current=false;void zoekInKaartgebied();return;}');",'focus cluster test');

const mapV2='src/test/bag/pandenverkennerMapV2.test.ts';
fs.appendFileSync(mapV2, `\n// 1G.2 UX-contract: serverclusters zijn interactief en kaartbeweging ververst gedebounced.\n`);
