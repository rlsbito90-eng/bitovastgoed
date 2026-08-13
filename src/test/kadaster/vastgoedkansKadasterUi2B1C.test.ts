import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const kaartBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansKadasterKaart.tsx'), 'utf8');
const detailBron = fs.readFileSync(path.join(root, 'src/pages/VastgoedkansDetailPage.tsx'), 'utf8');
const objectKaartBron = fs.readFileSync(path.join(root, 'src/components/object/kadaster/KadasterGebiedsdataKaart.tsx'), 'utf8');

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

  it('houdt PDF uit de Vastgoedkans-flow', () => {
    expect(kaartBron).toContain('includePdf: false');
    expect(kaartBron).not.toContain('setSelPdf');
    expect(kaartBron).not.toContain('Kadasterbericht/PDF intern opslaan');
  });

  it('houdt rechten standaard uit en vereist een aparte bevestiging', () => {
    expect(kaartBron).toContain('useState(false)');
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
