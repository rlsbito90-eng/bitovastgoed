import fs from 'node:fs';
const path = 'src/components/bag/BagPandenKaart.tsx';
let s = fs.readFileSync(path, 'utf8');
const must = (needle) => { if (!s.includes(needle)) throw new Error(`Anchor ontbreekt: ${needle.slice(0, 120)}`); };

must("import { useCallback, useMemo, useRef, useState } from 'react';");
s = s.replace("import { useCallback, useMemo, useRef, useState } from 'react';", "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';");
must("} from '@/lib/bag/kaartModel';");
s = s.replace("} from '@/lib/bag/kaartModel';", "} from '@/lib/bag/kaartModel';\nimport { bewaarKaartSessie, leesKaartSessie } from '@/lib/bag/kaartSession';");

must("  const [rows, setRows] = useState<BagKaartPandRij[]>([]);");
s = s.replace("  const [rows, setRows] = useState<BagKaartPandRij[]>([]);\n  const [laden, setLaden] = useState(false);\n  const [heeftGezocht, setHeeftGezocht] = useState(false);", `  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);\n  const initiëleSessie = useRef(leesKaartSessie(scopeCode, filterKey)).current;\n  const [rows, setRows] = useState<BagKaartPandRij[]>(initiëleSessie?.rows ?? []);\n  const [laden, setLaden] = useState(false);\n  const [heeftGezocht, setHeeftGezocht] = useState(initiëleSessie?.heeftGezocht ?? false);`);

must("  const geojson = useMemo(() => bouwBagKaartGeoJson(rows), [rows]);");
s = s.replace("  const geojson = useMemo(() => bouwBagKaartGeoJson(rows), [rows]);", `  useEffect(() => {\n    const sessie = leesKaartSessie(scopeCode, filterKey);\n    setRows(sessie?.rows ?? []);\n    setHeeftGezocht(sessie?.heeftGezocht ?? false);\n    setKaartVerouderd(false);\n    setGeselecteerd(null);\n    if (sessie?.viewState) mapRef.current?.jumpTo(sessie.viewState);\n  }, [scopeCode, filterKey]);\n\n  const geojson = useMemo(() => bouwBagKaartGeoJson(rows), [rows]);`);

must("      setRows(resultaat.rows);\n      setHeeftGezocht(true);");
s = s.replace("      setRows(resultaat.rows);\n      setHeeftGezocht(true);", `      setRows(resultaat.rows);\n      setHeeftGezocht(true);\n      const center = map.getCenter();\n      bewaarKaartSessie({ scopeCode, filterKey, rows: resultaat.rows, heeftGezocht: true, viewState: { longitude: center.lng, latitude: center.lat, zoom: map.getZoom() } });`);

must("          initialViewState={AMSTERDAM_VIEWPORT}");
s = s.replace("          initialViewState={AMSTERDAM_VIEWPORT}\n          onMoveEnd={() => { if (focusBewegingRef.current) { focusBewegingRef.current = false; return; } if (heeftGezocht) setKaartVerouderd(true); }}", `          initialViewState={initiëleSessie?.viewState ?? AMSTERDAM_VIEWPORT}\n          onMoveEnd={() => {\n            const map = mapRef.current?.getMap();\n            if (map) { const center = map.getCenter(); bewaarKaartSessie({ scopeCode, filterKey, rows, heeftGezocht, viewState: { longitude: center.lng, latitude: center.lat, zoom: map.getZoom() } }); }\n            if (focusBewegingRef.current) { focusBewegingRef.current = false; return; }\n            if (heeftGezocht) setKaartVerouderd(true);\n          }}`);

s = s.replace("Beweeg of zoom de kaart en kies daarna ‘Toon panden in beeld’. Dezelfde filters als de lijst worden gebruikt.", "De kaart onthoudt je laatste gebied binnen deze browsersessie. Verplaats of zoom en kies daarna ‘Zoek in dit gebied’.");
s = s.replaceAll('Toon panden in beeld', 'Zoek in dit gebied');

fs.writeFileSync(path, s);
