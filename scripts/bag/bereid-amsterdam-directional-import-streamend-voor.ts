import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BagOfficieelAdapterRecord } from '../../src/lib/bag/officieleXmlRecordAdapter';
import {
  normaliseerAmsterdamNdjsonStreamend,
  parseAmsterdamBronregel,
} from '../../src/lib/bag/amsterdamStreamingNormalisatie';
import { sorteerAmsterdamSpoolInChunks } from '../../src/lib/bag/amsterdamChunkedSpoolSort';
import { exporteerAmsterdamSpoolNaarCsvStreamend } from '../../src/lib/bag/amsterdamStreamingCsvExport';
import { maakVoorkomenSleutel } from '../../src/lib/bag/geometrieVoorkomenKoppeling';
import { evalueerAmsterdamImportPakket, type AmsterdamImportBestandsTelling } from '../../src/lib/bag/amsterdamImportPakket';
import {
  valideerAmsterdamDirectionalImportReadiness,
  type AmsterdamDirectionalFullSubsetBewijs,
} from '../../src/lib/bag/amsterdamDirectionalImportReadiness';

const TABELPERBESTAND: Record<string, string> = {
  objecten: 'bag_staging.objecten',
  voorkomens: 'bag_staging.voorkomens',
  relaties: 'bag_staging.relaties',
  geometrieen: 'bag_staging.geometrieen',
  geometrieAfwijkingen: 'quarantaine',
};

async function sha256Bestand(pad: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const blok of createReadStream(pad)) hash.update(blok);
  return hash.digest('hex');
}

function sorteersleutel(record: BagOfficieelAdapterRecord): string {
  return [
    record.objecttype,
    record.identificatie,
    maakVoorkomenSleutel({
      objecttype: record.objecttype,
      identificatie: record.identificatie,
      voorkomenidentificatie: record.voorkomen.voorkomenidentificatie,
      beginGeldigheid: record.voorkomen.beginGeldigheid,
      eindGeldigheid: record.voorkomen.eindGeldigheid,
      tijdstipRegistratie: record.voorkomen.tijdstipRegistratie,
      eindRegistratie: record.voorkomen.eindRegistratie,
      tijdstipInactief: record.voorkomen.tijdstipInactief,
    }),
  ].join('\u0000');
}

/**
 * Genereert schaalveilig uitsluitend een importpakket en manifest uit het bewezen
 * directionele Amsterdam/Weesp v3-full-subset. Voert geen database-import uit.
 */
export async function bereidAmsterdamDirectionalImportStreamendVoor(
  ndjsonPad: string,
  bewijsPad: string,
  outputPad: string,
  werkPad: string,
  datasetVersie = 'v20260808-directional-v3',
): Promise<{ besluit: 'GO' | 'STOP'; manifestPad: string }> {
  const bewijs = JSON.parse(readFileSync(resolve(bewijsPad), 'utf-8')) as AmsterdamDirectionalFullSubsetBewijs;
  const gemetenFullSubsetSha256 = await sha256Bestand(resolve(ndjsonPad));
  const readiness = valideerAmsterdamDirectionalImportReadiness(bewijs, gemetenFullSubsetSha256);

  const werkmap = resolve(werkPad);
  const outputDir = resolve(outputPad);
  const spoolPad = resolve(werkmap, 'genormaliseerd.ndjson');
  const foutenPad = resolve(outputDir, 'adapter-fouten.jsonl');
  const gesorteerdPad = resolve(werkmap, 'gesorteerd.ndjson');

  await rm(werkmap, { recursive: true, force: true });
  await mkdir(werkmap, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const normalisatie = await normaliseerAmsterdamNdjsonStreamend(
    ndjsonPad,
    spoolPad,
    foutenPad,
    parseAmsterdamBronregel,
  );

  if (normalisatie.gelezen !== readiness.standrecords) {
    throw new Error(
      `Standrecordtelling wijkt af van bewezen full-subset: gelezen=${normalisatie.gelezen}, verwacht=${readiness.standrecords}.`,
    );
  }
  if (normalisatie.genormaliseerd + normalisatie.fouten !== readiness.standrecords) {
    throw new Error(
      `Normalisatie is niet sluitend: genormaliseerd=${normalisatie.genormaliseerd}, fouten=${normalisatie.fouten}, ` +
      `verwacht=${readiness.standrecords}.`,
    );
  }

  const sortering = await sorteerAmsterdamSpoolInChunks<BagOfficieelAdapterRecord>({
    invoerPad: spoolPad,
    uitvoerPad: gesorteerdPad,
    werkmap: resolve(werkmap, 'chunks'),
    sleutel: sorteersleutel,
    maxRecordsPerChunk: 25_000,
  });

  const csvExport = await exporteerAmsterdamSpoolNaarCsvStreamend(gesorteerdPad, outputDir, {
    datasetVersie,
    scopeCode: '0363',
  });

  const bestanden: AmsterdamImportBestandsTelling[] = Object.entries(csvExport.bestanden).map(([naam, bestand]) => ({
    bestand: bestand.pad.split('/').at(-1) ?? naam,
    tabel: TABELPERBESTAND[naam] ?? 'quarantaine',
    regels: bestand.regels,
    sha256: bestand.sha256,
  }));
  bestanden.push({
    bestand: 'adapter-fouten.jsonl',
    tabel: 'quarantaine',
    regels: normalisatie.fouten,
    sha256: await sha256Bestand(foutenPad),
  });

  const manifest = evalueerAmsterdamImportPakket({
    datasetVersie,
    scopeCode: '0363',
    geselecteerdAantal: readiness.standrecords,
    selectieChecksum: readiness.selectieChecksum,
    bronSha256: readiness.bronSha256,
    bestanden,
    samenvatting: {
      ontvangen: normalisatie.gelezen,
      verwerkt: normalisatie.genormaliseerd,
      adapterFouten: normalisatie.fouten,
      stagingFouten: 0,
      objecten: csvExport.objecten,
      voorkomens: csvExport.voorkomens,
      relatiesBron: csvExport.relaties,
      relatiesUniek: csvExport.relaties,
      geometrieen: csvExport.geometrieen,
      overgeslagenGeometrieen: csvExport.geometrieAfwijkingen,
      ontbrekendeVoorkomenkoppelingen: csvExport.geometrieAfwijkingen,
      ambigueVoorkomenkoppelingen: 0,
    },
  });

  const manifestPad = resolve(outputDir, 'importpakket-manifest.json');
  writeFileSync(manifestPad, `${JSON.stringify({
    ...manifest,
    directioneleScope: {
      naam: 'Amsterdam+Weesp',
      metadataSchemaVersion: 3,
      uniekeSleutels: readiness.uniekeSleutels,
      standrecords: readiness.standrecords,
      fullSubsetSha256: readiness.fullSubsetSha256,
      selectieChecksum: readiness.selectieChecksum,
    },
    streaming: {
      normalisatie,
      sortering,
      outputBytes: Object.values(csvExport.bestanden).reduce((som, bestand) => som + statSync(bestand.pad).size, 0),
    },
    databaseImportUitgevoerd: false,
    supabaseBenaderd: false,
    productieBenaderd: false,
  }, null, 2)}\n`, 'utf-8');

  await rm(werkmap, { recursive: true, force: true });
  return { besluit: manifest.besluit, manifestPad };
}

if (process.argv[1]?.endsWith('bereid-amsterdam-directional-import-streamend-voor.ts')) {
  const [ndjson, bewijs, output, werkmap, datasetVersie] = process.argv.slice(2);
  if (!ndjson || !bewijs || !output || !werkmap) {
    console.error(
      'Gebruik: bereid-amsterdam-directional-import-streamend-voor.ts <full-subset.ndjson> <bewijs.json> <output> <werkmap> [datasetVersie]',
    );
    process.exit(2);
  }
  bereidAmsterdamDirectionalImportStreamendVoor(ndjson, bewijs, output, werkmap, datasetVersie)
    .then(resultaat => {
      console.log(`besluit=${resultaat.besluit} manifest=${resultaat.manifestPad}`);
      process.exit(resultaat.besluit === 'GO' ? 0 : 1);
    })
    .catch(error => {
      console.error(String(error));
      process.exit(1);
    });
}
