import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { exporteerAssenNaarPostgisCsv } from './exporteer-assen-naar-postgis-csv';
import {
  evalueerAmsterdamImportPakket,
  type AmsterdamImportBestandsTelling,
} from '../../src/lib/bag/amsterdamImportPakket';
import { AMSTERDAM_BRON_SHA256 } from '../../src/lib/bag/amsterdamMetadataIndex';

const TABELPERBESTAND: Record<string, string> = {
  'objecten.csv': 'bag_staging.objecten',
  'voorkomens.csv': 'bag_staging.voorkomens',
  'relaties.csv': 'bag_staging.relaties',
  'geometrieen.csv': 'bag_staging.geometrieen',
};

async function telEnHashBestand(pad: string): Promise<{ regels: number; sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  const hashStream = createReadStream(pad);
  for await (const blok of hashStream) hash.update(blok);

  let regels = 0;
  const regelsStream = createInterface({
    input: createReadStream(pad, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  for await (const regel of regelsStream) {
    if (regel.trim().length > 0) regels += 1;
  }

  return {
    regels,
    sha256: hash.digest('hex'),
    bytes: statSync(pad).size,
  };
}

async function tellingen(outputDir: string): Promise<{
  bestanden: AmsterdamImportBestandsTelling[];
  outputBytes: number;
}> {
  const namen = readdirSync(outputDir)
    .filter(naam => naam.endsWith('.csv') || naam.endsWith('.jsonl'))
    .sort();

  const bestanden: AmsterdamImportBestandsTelling[] = [];
  let outputBytes = 0;
  for (const naam of namen) {
    const pad = resolve(outputDir, naam);
    const telling = await telEnHashBestand(pad);
    outputBytes += telling.bytes;
    bestanden.push({
      bestand: naam,
      tabel: TABELPERBESTAND[naam] ?? 'quarantaine',
      regels: telling.regels,
      sha256: telling.sha256,
    });
  }
  return { bestanden, outputBytes };
}

/**
 * Zet de gevalideerde Amsterdam full-subset om naar de bestaande BAG PostGIS-contracten
 * en schrijft een importmanifest met GO/STOP-besluit. Voert géén database-import uit.
 */
export async function bereidAmsterdamImportVoor(
  ndjsonPad = 'bag-amsterdam/full-subset.ndjson',
  closurePad = 'bag-amsterdam/metadata/closure-bewijs.json',
  outputPad = 'bag-amsterdam/importpakket',
  datasetVersie = 'v20260805',
): Promise<{ besluit: 'GO' | 'STOP'; manifestPad: string }> {
  const closure = JSON.parse(readFileSync(resolve(closurePad), 'utf-8')) as {
    status: string;
    geselecteerdeRecords?: number;
    selectieChecksum?: string;
  };
  if (
    closure.status !== 'closure_validated' ||
    !Number.isInteger(closure.geselecteerdeRecords) ||
    (closure.geselecteerdeRecords ?? 0) <= 0 ||
    !closure.selectieChecksum
  ) {
    throw new Error(`Closure niet volledig gevalideerd (status ${closure.status}); importvoorbereiding gestopt.`);
  }

  const samenvatting = await exporteerAssenNaarPostgisCsv(ndjsonPad, outputPad, {
    datasetVersie,
    scopeCode: '0363',
  });
  const outputDir = resolve(outputPad);
  const bestandsbewijs = await tellingen(outputDir);

  const manifest = evalueerAmsterdamImportPakket({
    datasetVersie,
    scopeCode: '0363',
    geselecteerdAantal: closure.geselecteerdeRecords!,
    selectieChecksum: closure.selectieChecksum,
    bronSha256: AMSTERDAM_BRON_SHA256,
    bestanden: bestandsbewijs.bestanden,
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

  const manifestPad = resolve(outputDir, 'importpakket-manifest.json');
  writeFileSync(
    manifestPad,
    `${JSON.stringify({ ...manifest, outputBytes: bestandsbewijs.outputBytes }, null, 2)}\n`,
    'utf-8',
  );
  return { besluit: manifest.besluit, manifestPad };
}

if (process.argv[1] && process.argv[1].endsWith('bereid-amsterdam-import-voor.ts')) {
  const [ndjson, closure, output] = process.argv.slice(2);
  bereidAmsterdamImportVoor(ndjson, closure, output)
    .then(resultaat => {
      console.log(`besluit=${resultaat.besluit} manifest=${resultaat.manifestPad}`);
      process.exit(resultaat.besluit === 'GO' ? 0 : 1);
    })
    .catch(error => {
      console.error(String(error));
      process.exit(1);
    });
}
