import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { parseOfficieelBagRecord, type BagOfficieelAdapterRecord } from '../../src/lib/bag/officieleXmlRecordAdapter';
import { voerIntegraleBagDryRunUit } from '../../src/lib/bag/integraleDryRun';

interface NdjsonRecord {
  bronpad: string;
  xml: string;
}

type CsvValue = string | number | boolean | null;

function csv(value: CsvValue): string {
  if (value == null) return '';
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function datum(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function geometrieWkt(
  coordinaten: number[],
  dimensie: 2 | 3,
  objecttype: string,
): string | null {
  const punten: Array<[number, number, number]> = [];
  for (let index = 0; index < coordinaten.length; index += dimensie) {
    const x = coordinaten[index];
    const y = coordinaten[index + 1];
    const z = dimensie === 3 ? coordinaten[index + 2] : 0;
    if (![x, y, z].every(Number.isFinite)) return null;
    punten.push([x, y, z]);
  }

  if (objecttype === 'Verblijfsobject') {
    const punt = punten[0];
    return punt ? `POINT Z (${punt.join(' ')})` : null;
  }

  if (punten.length < 3) return null;
  const eerste = punten[0];
  const laatste = punten.at(-1);
  if (!laatste || eerste.some((waarde, index) => waarde !== laatste[index])) punten.push([...eerste]);
  if (punten.length < 4) return null;
  return `POLYGON Z ((${punten.map(punt => punt.join(' ')).join(', ')}))`;
}

export interface BagPostgisCsvExportSamenvatting {
  ontvangen: number;
  verwerkt: number;
  adapterFouten: number;
  stagingFouten: number;
  objecten: number;
  voorkomens: number;
  relatiesBron: number;
  relatiesUniek: number;
  geometrieen: number;
  overgeslagenGeometrieen: number;
  outputDir: string;
}

export async function exporteerAssenNaarPostgisCsv(
  inputPath = 'bag-broninspectie/records.ndjson',
  outputPath = 'bag-broninspectie/postgis-export',
): Promise<BagPostgisCsvExportSamenvatting> {
  const input = resolve(inputPath);
  const outputDir = resolve(outputPath);
  mkdirSync(outputDir, { recursive: true });

  const records: BagOfficieelAdapterRecord[] = [];
  const adapterFouten: string[] = [];
  let ontvangen = 0;

  const lines = createInterface({ input: createReadStream(input, { encoding: 'utf-8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    ontvangen += 1;
    let item: NdjsonRecord;
    try {
      item = JSON.parse(line) as NdjsonRecord;
    } catch (error) {
      adapterFouten.push(`ongeldige_ndjson:regel_${ontvangen}:${String(error)}`);
      continue;
    }
    const parsed = parseOfficieelBagRecord(item.xml);
    for (const fout of parsed.fouten) adapterFouten.push(`${fout.code}:${item.bronpad}:${fout.reden}`);
    if (parsed.record) records.push(parsed.record);
  }

  const dryRun = voerIntegraleBagDryRunUit({
    datasetVersie: 'v20200601',
    scopeCode: '0106',
    records,
    batchGrootte: 5_000,
  });
  const staging = dryRun.staging;

  writeFileSync(
    resolve(outputDir, 'objecten.csv'),
    staging.objecten.map(item => [item.objecttype, item.identificatie].map(csv).join(',')).join('\n') + '\n',
    'utf-8',
  );

  writeFileSync(
    resolve(outputDir, 'voorkomens.csv'),
    staging.voorkomens.map(item => {
      const uitgebreideVelden = {
        ...item.velden,
        tijdstipRegistratie: item.tijdstipRegistratie,
        eindRegistratie: item.eindRegistratie,
        tijdstipInactief: item.tijdstipInactief,
      };
      return [
        item.objecttype,
        item.identificatie,
        item.voorkomenidentificatie,
        item.isActueel,
        datum(item.beginGeldigheid),
        datum(item.eindGeldigheid),
        item.status,
        JSON.stringify(uitgebreideVelden),
      ].map(csv).join(',');
    }).join('\n') + '\n',
    'utf-8',
  );

  const relatieSleutels = new Set<string>();
  const relaties = staging.relaties.filter(item => {
    const sleutel = `${item.bronObjecttype}\u0000${item.bronIdentificatie}\u0000${item.relatietype}\u0000${item.doelIdentificatie}`;
    if (relatieSleutels.has(sleutel)) return false;
    relatieSleutels.add(sleutel);
    return true;
  });
  writeFileSync(
    resolve(outputDir, 'relaties.csv'),
    relaties.map(item => [item.bronObjecttype, item.bronIdentificatie, item.relatietype, item.doelIdentificatie].map(csv).join(',')).join('\n') + '\n',
    'utf-8',
  );

  let overgeslagenGeometrieen = 0;
  const geometrieRegels: string[] = [];
  for (const item of staging.geometrieen) {
    if (item.voorkomenidentificatie == null) {
      overgeslagenGeometrieen += 1;
      continue;
    }
    const wkt = geometrieWkt(item.coordinaten, item.dimensie, item.objecttype);
    if (!wkt) {
      overgeslagenGeometrieen += 1;
      continue;
    }
    geometrieRegels.push([
      item.objecttype,
      item.identificatie,
      item.voorkomenidentificatie,
      wkt,
    ].map(csv).join(','));
  }
  writeFileSync(resolve(outputDir, 'geometrieen.csv'), geometrieRegels.join('\n') + '\n', 'utf-8');

  const samenvatting: BagPostgisCsvExportSamenvatting = {
    ontvangen,
    verwerkt: records.length,
    adapterFouten: adapterFouten.length,
    stagingFouten: staging.fouten.length,
    objecten: staging.objecten.length,
    voorkomens: staging.voorkomens.length,
    relatiesBron: staging.relaties.length,
    relatiesUniek: relaties.length,
    geometrieen: geometrieRegels.length,
    overgeslagenGeometrieen,
    outputDir,
  };

  writeFileSync(resolve(outputDir, 'manifest.json'), `${JSON.stringify({
    ...samenvatting,
    datasetVersie: 'v20200601',
    scopeCode: '0106',
    stagingFouten: staging.fouten,
    adapterFouten: adapterFouten.slice(0, 100),
  }, null, 2)}\n`, 'utf-8');

  return samenvatting;
}
