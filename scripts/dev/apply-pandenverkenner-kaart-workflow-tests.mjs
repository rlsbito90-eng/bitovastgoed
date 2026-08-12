import fs from 'node:fs';

const kaartPath = 'src/components/bag/BagPandenKaart.tsx';
let kaart = fs.readFileSync(kaartPath, 'utf8');
kaart = kaart.replace("Start met ‘Zoek in dit kaartgebied’ om panden op de kaart te laden.", "Start met ‘Toon panden in beeld’ om panden op de kaart te laden.");
fs.writeFileSync(kaartPath, kaart);

const kaartTestPath = 'src/lib/bag/pandenverkennerKaart1E1.test.ts';
let kaartTest = fs.readFileSync(kaartTestPath, 'utf8');
kaartTest = kaartTest.replace("    expect(component).toContain('Zoek in dit kaartgebied');", "    expect(component).toContain('Toon panden in beeld');");
kaartTest = kaartTest.replace(
  "    expect(component).toContain('onMoveEnd={() => { if (heeftGezocht) setKaartVerouderd(true); }}');",
  "    expect(component).toContain('if (focusBewegingRef.current) { focusBewegingRef.current = false; return; }');\n    expect(component).toContain('if (heeftGezocht) setKaartVerouderd(true);');",
);
fs.writeFileSync(kaartTestPath, kaartTest);

const uiTestPath = 'src/lib/bag/pandenverkennerUiContract.test.ts';
let uiTest = fs.readFileSync(uiTestPath, 'utf8');
uiTest = uiTest.replace("    expect(component.split('Er is niets opgeslagen.')).toHaveLength(2);", "    expect(component.split('Er is niets opgeslagen.')).toHaveLength(3);");
fs.writeFileSync(uiTestPath, uiTest);
