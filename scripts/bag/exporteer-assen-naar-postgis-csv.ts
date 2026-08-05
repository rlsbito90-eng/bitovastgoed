import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { parseOfficieelBagRecord, type BagOfficieelAdapterRecord } from '../../src/lib/bag/officieleXmlRecordAdapter';
import { voerIntegraleBagDryRunUit } from '../../src/lib/bag/integraleDryRun';
import {
  koppelGeometrieAanVoorkomen,
  maakVoorkomenBrongroepSleutel,
  maakVoorkomenSleutel,
  type BagVoorkomenKandidaat,
} from '../../src/lib/bag/geometrieVoorkomenKoppeling';

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
  ontbrekendeVoorkomenkoppelingen: number;
  ambigueVoorkomenkoppelingen: number;
  dubbeleVoorkomenidentificaties: number;
  outputDir: string;
}

export async function exporteerAssenNaarPostgisCsv(
  inputPath = 'bag-broninspectie/records.ndjson',
  outputPath = 'bag-broninspectie/postgis-export',
  opties: { datasetVersie?: string; scopeCode?: string } = {},
): Promise<BagPostgisCsvExportSamenvatting> {
  const datasetVersie = opties.datasetVersie ?? 'v20200601';
  const scopeCode = opties.scopeCode ?? '0106';
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
    datasetVersie: datasetVersie,
    scopeCode: scopeCode,
    records,
    batchGrootte: 5_000,
  });
  const staging = dryRun.staging;

  writeFileSync(
    resolve(outputDir, 'objecten.csv'),
    staging.objecten.map(item => [item.objecttype, item.identificatie].map(csv).join(',')).join('\n') + '\n',
    'utf-8',
  );

  const voorkomenKandidatenPerBron = new Map<string, BagVoorkomenKandidaat[]>();
  const voorkomenBasisTellingen = new Map<string, number>();
  writeFileSync(
    resolve(outputDir, 'voorkomens.csv'),
    staging.voorkomens.map(item => {
      const uitgebreideVelden = {
        ...item.velden,
        tijdstipRegistratie: item.tijdstipRegistratie,
        eindRegistratie: item.eindRegistratie,
        tijdstipInactief: item.tijdstipInactief,
      };
      const sleutel = maakVoorkomenSleutel(item);
      const bronSleutel = maakVoorkomenBrongroepSleutel(item);
      const kandidaten = voorkomenKandidatenPerBron.get(bronSleutel) ?? [];
      kandidaten.push({ ...item, voorkomenSleutel: sleutel, status: item.status });
      voorkomenKandidatenPerBron.set(bronSleutel, kandidaten);
      voorkomenBasisTellingen.set(bronSleutel, (voorkomenBasisTellingen.get(bronSleutel) ?? 0) + 1);
      return [
        item.objecttype,
        item.identificatie,
        sleutel,
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

  const geometrieRegels: string[] = [];
  const geometrieVolgnummers = new Map<string, number>();
  const geometrieKoppelafwijkingen: Array<{
    code: 'ontbrekende_voorkomenkoppeling' | 'ambigue_voorkomenkoppeling' | 'ongeldige_brongeometrie';
    objecttype: string;
    identificatie: string;
    bronmetadata: {
      voorkomenidentificatie: number | null;
      beginGeldigheid: string | null;
      eindGeldigheid: string | null;
      tijdstipRegistratie: string | null;
      eindRegistratie: string | null;
      tijdstipInactief: string | null;
    };
    bronWkt: string | null;
    bronGeometrie: {
      crs: 'EPSG:28992';
      dimensie: 2 | 3;
      coordinaten: number[];
    };
    kandidaten: BagVoorkomenKandidaat[];
  }> = [];
  for (const item of staging.geometrieen) {
    const wkt = geometrieWkt(item.coordinaten, item.dimensie, item.objecttype);
    const bronSleutel = maakVoorkomenBrongroepSleutel(item);
    const koppeling = koppelGeometrieAanVoorkomen(
      item,
      voorkomenKandidatenPerBron.get(bronSleutel) ?? [],
    );
    if (koppeling.status !== 'gekoppeld' || !wkt) {
      geometrieKoppelafwijkingen.push({
        code: koppeling.status === 'gekoppeld' ? 'ongeldige_brongeometrie' : koppeling.status,
        objecttype: item.objecttype,
        identificatie: item.identificatie,
        bronmetadata: {
          voorkomenidentificatie: item.voorkomenidentificatie,
          beginGeldigheid: item.beginGeldigheid,
          eindGeldigheid: item.eindGeldigheid,
          tijdstipRegistratie: item.tijdstipRegistratie,
          eindRegistratie: item.eindRegistratie,
          tijdstipInactief: item.tijdstipInactief,
        },
        bronWkt: wkt,
        bronGeometrie: {
          crs: item.crs,
          dimensie: item.dimensie,
          coordinaten: [...item.coordinaten],
        },
        kandidaten: koppeling.kandidaten,
      });
      continue;
    }
    const geometrieSleutel = [item.objecttype, item.identificatie, koppeling.voorkomenSleutel].join('\u0000');
    const geometrieVolgnummer = (geometrieVolgnummers.get(geometrieSleutel) ?? 0) + 1;
    geometrieVolgnummers.set(geometrieSleutel, geometrieVolgnummer);
    geometrieRegels.push([
      item.objecttype,
      item.identificatie,
      koppeling.voorkomenSleutel,
      item.voorkomenidentificatie,
      geometrieVolgnummer,
      wkt,
    ].map(csv).join(','));
  }
  writeFileSync(resolve(outputDir, 'geometrieen.csv'), geometrieRegels.join('\n') + '\n', 'utf-8');
  writeFileSync(
    resolve(outputDir, 'geometrie-koppelafwijkingen.jsonl'),
    geometrieKoppelafwijkingen.length > 0
      ? `${geometrieKoppelafwijkingen.map(item => JSON.stringify(item)).join('\n')}\n`
      : '',
    'utf-8',
  );

  const dubbeleVoorkomenidentificaties = [...voorkomenBasisTellingen.values()].filter(aantal => aantal > 1).length;
  const ontbrekendeVoorkomenkoppelingen = geometrieKoppelafwijkingen.filter(
    item => item.code === 'ontbrekende_voorkomenkoppeling',
  ).length;
  const ambigueVoorkomenkoppelingen = geometrieKoppelafwijkingen.filter(
    item => item.code === 'ambigue_voorkomenkoppeling',
  ).length;
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
    overgeslagenGeometrieen: geometrieKoppelafwijkingen.length,
    ontbrekendeVoorkomenkoppelingen,
    ambigueVoorkomenkoppelingen,
    dubbeleVoorkomenidentificaties,
    outputDir,
  };

  writeFileSync(resolve(outputDir, 'manifest.json'), `${JSON.stringify({
    ...samenvatting,
    datasetVersie: datasetVersie,
    scopeCode: scopeCode,
    stagingFouten: staging.fouten,
    adapterFouten: adapterFouten.slice(0, 100),
  }, null, 2)}\n`, 'utf-8');

  return samenvatting;
}
