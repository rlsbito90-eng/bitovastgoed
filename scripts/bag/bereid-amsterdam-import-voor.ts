import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

function tellingen(outputDir: string): AmsterdamImportBestandsTelling[] {
  return readdirSync(outputDir)
    .filter(naam => naam.endsWith('.csv') || naam.endsWith('.jsonl'))
    .sort()
    .map(naam => {
      const pad = resolve(outputDir, naam);
      const inhoud = readFileSync(pad, 'utf-8');
      return {
        bestand: naam,
        tabel: TABELPERBESTAND[naam] ?? 'quarantaine',
        regels: inhoud.split('\n').filter(regel => regel.trim().length > 0).length,
        sha256: createHash('sha256').update(inhoud, 'utf-8').digest('hex'),
      };
    });
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
    rapport: { records: number; selectieChecksum: string } | null;
  };
  if (closure.status !== 'closure_validated' || !closure.rapport) {
    throw new Error(`Closure niet gevalideerd (status ${closure.status}); importvoorbereiding gestopt.`);
  }

  const samenvatting = await exporteerAssenNaarPostgisCsv(ndjsonPad, outputPad, {
    datasetVersie,
    scopeCode: '0363',
  });
  const outputDir = resolve(outputPad);

  const manifest = evalueerAmsterdamImportPakket({
    datasetVersie,
    scopeCode: '0363',
    geselecteerdAantal: closure.rapport.records,
    selectieChecksum: closure.rapport.selectieChecksum,
    bronSha256: AMSTERDAM_BRON_SHA256,
    bestanden: tellingen(outputDir),
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
    `${JSON.stringify({ ...manifest, outputBytes: statSync(outputDir).size }, null, 2)}\n`,
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
