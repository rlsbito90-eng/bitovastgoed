import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { exporteerAssenNaarPostgisCsv } from './exporteer-assen-naar-postgis-csv';
import { evalueerAmsterdamImportPakket, type AmsterdamImportBestandsTelling } from '../../src/lib/bag/amsterdamImportPakket';
import {
  valideerAmsterdamDirectionalImportReadiness,
  type AmsterdamDirectionalFullSubsetBewijs,
} from '../../src/lib/bag/amsterdamDirectionalImportReadiness';

const TABELPERBESTAND: Record<string, string> = {
  'objecten.csv': 'bag_staging.objecten',
  'voorkomens.csv': 'bag_staging.voorkomens',
  'relaties.csv': 'bag_staging.relaties',
  'geometrieen.csv': 'bag_staging.geometrieen',
};

async function sha256Bestand(pad: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const blok of createReadStream(pad)) hash.update(blok);
  return hash.digest('hex');
}

async function telEnHashBestand(pad: string): Promise<{ regels: number; sha256: string; bytes: number }> {
  const sha256 = await sha256Bestand(pad);
  let regels = 0;
  const stream = createInterface({ input: createReadStream(pad, { encoding: 'utf-8' }), crlfDelay: Infinity });
  for await (const regel of stream) if (regel.trim().length > 0) regels += 1;
  return { regels, sha256, bytes: statSync(pad).size };
}

async function bestandsbewijs(outputDir: string): Promise<{ bestanden: AmsterdamImportBestandsTelling[]; outputBytes: number }> {
  const namen = readdirSync(outputDir).filter(naam => naam.endsWith('.csv') || naam.endsWith('.jsonl')).sort();
  const bestanden: AmsterdamImportBestandsTelling[] = [];
  let outputBytes = 0;
  for (const naam of namen) {
    const telling = await telEnHashBestand(resolve(outputDir, naam));
    outputBytes += telling.bytes;
    bestanden.push({ bestand: naam, tabel: TABELPERBESTAND[naam] ?? 'quarantaine', regels: telling.regels, sha256: telling.sha256 });
  }
  return { bestanden, outputBytes };
}

/** Genereert uitsluitend een importpakket + manifest; voert geen database-import uit. */
export async function bereidAmsterdamDirectionalImportVoor(
  ndjsonPad: string,
  bewijsPad: string,
  outputPad: string,
  datasetVersie = 'v20260808-directional-v3',
): Promise<{ besluit: 'GO' | 'STOP'; manifestPad: string }> {
  const bewijs = JSON.parse(readFileSync(resolve(bewijsPad), 'utf-8')) as AmsterdamDirectionalFullSubsetBewijs;
  const gemetenFullSubsetSha256 = await sha256Bestand(resolve(ndjsonPad));
  const readiness = valideerAmsterdamDirectionalImportReadiness(bewijs, gemetenFullSubsetSha256);

  const samenvatting = await exporteerAssenNaarPostgisCsv(ndjsonPad, outputPad, {
    datasetVersie,
    scopeCode: '0363',
  });
  const bestanden = await bestandsbewijs(resolve(outputPad));

  const manifest = evalueerAmsterdamImportPakket({
    datasetVersie,
    scopeCode: '0363',
    // De importpoort vergelijkt standrecords/voorkomens, niet unieke BAG-object-ID's.
    geselecteerdAantal: readiness.standrecords,
    selectieChecksum: readiness.selectieChecksum,
    bronSha256: readiness.bronSha256,
    bestanden: bestanden.bestanden,
    samenvatting: {
      ontvangen: samenvatting.ontvangen,
      verwerkt: samenvatting.verwerkt,
      adapterFouten: samenvatting.adapterFouten,
      stagingFouten: samenvatting.stagingFouten,
      objecten: samenvatting.objecten,
      voorkomens: samenvatting.voorkomens,
      relatiesBron: samenvatting.relatiesBron,
      relatiesUniek: samenvatting.relatiesUniek,
      geometrieen: samenvatting.geometrieen,
      overgeslagenGeometrieen: samenvatting.overgeslagenGeometrieen,
      ontbrekendeVoorkomenkoppelingen: samenvatting.ontbrekendeVoorkomenkoppelingen,
      ambigueVoorkomenkoppelingen: samenvatting.ambigueVoorkomenkoppelingen,
    },
  });

  const manifestPad = resolve(outputPad, 'importpakket-manifest.json');
  writeFileSync(manifestPad, `${JSON.stringify({
    ...manifest,
    directioneleScope: {
      uniekeSleutels: readiness.uniekeSleutels,
      standrecords: readiness.standrecords,
      fullSubsetSha256: readiness.fullSubsetSha256,
      metadataSchemaVersion: 3,
    },
    outputBytes: bestanden.outputBytes,
  }, null, 2)}\n`, 'utf-8');
  return { besluit: manifest.besluit, manifestPad };
}

if (process.argv[1]?.endsWith('bereid-amsterdam-directional-import-voor.ts')) {
  const [ndjson, bewijs, output, datasetVersie] = process.argv.slice(2);
  if (!ndjson || !bewijs || !output) {
    console.error('Gebruik: bereid-amsterdam-directional-import-voor.ts <full-subset.ndjson> <bewijs.json> <output> [datasetVersie]');
    process.exit(2);
  }
  bereidAmsterdamDirectionalImportVoor(ndjson, bewijs, output, datasetVersie)
    .then(resultaat => {
      console.log(`besluit=${resultaat.besluit} manifest=${resultaat.manifestPad}`);
      process.exit(resultaat.besluit === 'GO' ? 0 : 1);
    })
    .catch(error => {
      console.error(String(error));
      process.exit(1);
    });
}
