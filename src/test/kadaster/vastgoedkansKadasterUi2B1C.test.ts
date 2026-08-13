import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const kaartBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansKadasterKaart.tsx'), 'utf8');
const detailBron = fs.readFileSync(path.join(root, 'src/pages/VastgoedkansDetailPage.tsx'), 'utf8');
const objectKaartBron = fs.readFileSync(path.join(root, 'src/components/object/kadaster/KadasterGebiedsdataKaart.tsx'), 'utf8');
const bagLookupBron = fs.readFileSync(path.join(root, 'src/components/shared/BagAdresLookup.tsx'), 'utf8');
const documentenHookBron = fs.readFileSync(path.join(root, 'src/hooks/useKadasterDocumenten.tsx'), 'utf8');

describe('BUILD 2.0B.1C — Vastgoedkans Kadaster-UI', () => {
  it('persist uitsluitend naar de Vastgoedkans-context', () => {
    expect(kaartBron).toContain("context: { vastgoedkans_id: vastgoedkansId }");
    expect(kaartBron).toContain('persist: true');
    expect(kaartBron).not.toContain('object_id: vastgoedkansId');
    expect(kaartBron).not.toContain('signaal_id: vastgoedkansId');
  });

  it('kan de betaalde call alleen vanuit expliciete bevestiging starten', () => {
    expect(kaartBron).toContain('setKostenOpen(true)');
    expect(kaartBron).toContain('await voerCallUit()');
    expect(kaartBron).not.toContain('useEffect(');
    expect(kaartBron).not.toContain('setInterval(');
    expect(kaartBron).not.toContain('setTimeout(');
  });

  it('vereist eerst dezelfde officiële BAG/PDOK-resolutie als Radar', () => {
    expect(kaartBron).toContain("import BagAdresLookup from '@/components/shared/BagAdresLookup';");
    expect(kaartBron).toContain('<BagAdresLookup');
    expect(kaartBron).toContain('const adresKlaar = !!gekozenBagAdres && !!postcodeApi && !!huisnummer;');
    expect(kaartBron).toContain('gekozenBagAdres.huisnummertoevoeging');
    expect(bagLookupBron).toContain('zoekBagAdressen');
    expect(bagLookupBron).toContain('BAG-adres controleren (PDOK)');
  });

  it('ondersteunt nu optionele PDF-opslag en teruglezen voor Vastgoedkansen', () => {
    expect(kaartBron).toContain('const [selPdf, setSelPdf] = useState(true);');
    expect(kaartBron).toContain('includePdf: selPdf');
    expect(kaartBron).toContain('Kadasterbericht/PDF intern opslaan');
    expect(kaartBron).toContain('useKadasterDocumentenForVastgoedkans(vastgoedkansId)');
    expect(kaartBron).toContain('Kadasterbericht openen');
    expect(documentenHookBron).toContain("type Col = 'object_id' | 'signaal_id' | 'vastgoedkans_id';");
    expect(documentenHookBron).toContain("gebruikKadasterDocumenten('vastgoedkans_id', vastgoedkansId)");
  });

  it('houdt rechten standaard uit en vereist een aparte bevestiging', () => {
    expect(kaartBron).toContain('setRechtenOpen(true)');
    expect(kaartBron).toContain('Rechten / eigendomsinformatie bevestigen');
    expect(kaartBron).toContain('er wordt geen eigenaar of relatie automatisch aangemaakt of gekoppeld');
  });

  it('leest opgeslagen Vastgoedkans-records terug zonder automatische overname', () => {
    expect(kaartBron).toContain('useKadasterDataRecordsForVastgoedkans(vastgoedkansId)');
    expect(kaartBron).toContain("['kadaster_data_records', 'vastgoedkans', vastgoedkansId]");
    expect(kaartBron).not.toContain('setForm(');
    expect(kaartBron).not.toContain('updateKans(');
  });

  it('is alleen in VastgoedkansDetailPage gekoppeld en laat de Object-kaart ongemoeid', () => {
    expect(detailBron).toContain("import VastgoedkansKadasterKaart from '@/components/acquisitie/VastgoedkansKadasterKaart';");
    expect(detailBron).toContain('<VastgoedkansKadasterKaart vastgoedkansId={kans.id}');
    expect(objectKaartBron).toContain('context: { object_id: objectId }');
    expect(objectKaartBron).not.toContain('VastgoedkansKadasterKaart');
  });
});
