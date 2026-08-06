import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { BagOfficieelAdapterRecord } from '../../src/lib/bag/officieleXmlRecordAdapter';
import {
  normaliseerAmsterdamNdjsonStreamend,
  parseAmsterdamBronregel,
  type AmsterdamBronregel,
  type AmsterdamStreamingParserResultaat,
} from '../../src/lib/bag/amsterdamStreamingNormalisatie';
import { sorteerAmsterdamSpoolInChunks } from '../../src/lib/bag/amsterdamChunkedSpoolSort';
import { exporteerAmsterdamSpoolNaarCsvStreamend } from '../../src/lib/bag/amsterdamStreamingCsvExport';
import { maakVoorkomenSleutel } from '../../src/lib/bag/geometrieVoorkomenKoppeling';
import { evalueerAmsterdamImportPakket, type AmsterdamImportBestandsTelling } from '../../src/lib/bag/amsterdamImportPakket';
import { AMSTERDAM_BRON_SHA256 } from '../../src/lib/bag/amsterdamMetadataIndex';

const IN_ONDERZOEK_BRONBESTAND = '9999InOnderzoek08072026.zip';

const TABELPERBESTAND: Record<string, string> = {
  objecten: 'bag_staging.objecten',
  voorkomens: 'bag_staging.voorkomens',
  relaties: 'bag_staging.relaties',
  geometrieen: 'bag_staging.geometrieen',
  geometrieAfwijkingen: 'quarantaine',
};

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

export function isAmsterdamInOnderzoekNevenlevering(bronpad: string): boolean {
  return bronpad
    .split(/[\\/]/)
    .some(deel => basename(deel) === IN_ONDERZOEK_BRONBESTAND);
}

export async function bereidAmsterdamImportStreamendVoor(
  ndjsonPad = 'bag-amsterdam/full-subset.ndjson',
  closurePad = 'bag-amsterdam/metadata/closure-bewijs.json',
  outputPad = 'bag-amsterdam/importpakket',
  werkPad = 'bag-amsterdam/streaming-werk',
  datasetVersie = 'v20260805',
): Promise<{ besluit: 'GO' | 'STOP'; manifestPad: string }> {
  const closure = JSON.parse(readFileSync(resolve(closurePad), 'utf-8')) as {
    status: string;
    geselecteerdeRecords?: number;
    selectieChecksum?: string;
  };
  if (closure.status !== 'closure_validated' || !Number.isInteger(closure.geselecteerdeRecords) || !closure.selectieChecksum) {
    throw new Error(`Closure niet volledig gevalideerd (status ${closure.status}); streaming-importvoorbereiding gestopt.`);
  }

  const werkmap = resolve(werkPad);
  const outputDir = resolve(outputPad);
  const spoolPad = resolve(werkmap, 'genormaliseerd.ndjson');
  const foutenPad = resolve(outputDir, 'adapter-fouten.jsonl');
  const gesorteerdPad = resolve(werkmap, 'gesorteerd.ndjson');
  const nevenleveringBewijsPad = resolve(outputDir, 'in-onderzoek-nevenlevering-bewijs.json');
  await rm(werkmap, { recursive: true, force: true });
  await mkdir(werkmap, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  let inOnderzoekRecords = 0;
  const inOnderzoekBronpaden = new Set<string>();
  const parser = (
    bronregel: AmsterdamBronregel,
  ): AmsterdamStreamingParserResultaat<BagOfficieelAdapterRecord> => {
    if (isAmsterdamInOnderzoekNevenlevering(bronregel.bronpad)) {
      inOnderzoekRecords += 1;
      inOnderzoekBronpaden.add(bronregel.bronpad);
      return { record: null, fouten: [] };
    }
    return parseAmsterdamBronregel(bronregel);
  };

  const normalisatie = await normaliseerAmsterdamNdjsonStreamend(
    ndjsonPad,
    spoolPad,
    foutenPad,
    parser,
  );

  if (inOnderzoekRecords === 0) {
    throw new Error(`Verwachte InOnderzoek-nevenlevering ${IN_ONDERZOEK_BRONBESTAND} niet aangetroffen; importvoorbereiding fail-closed gestopt.`);
  }

  const importeerbareSelectie = closure.geselecteerdeRecords! - inOnderzoekRecords;
  if (importeerbareSelectie <= 0 || normalisatie.genormaliseerd + normalisatie.fouten !== importeerbareSelectie) {
    throw new Error(
      `Nevenleveringcorrectie is niet sluitend: closure=${closure.geselecteerdeRecords}, nevenlevering=${inOnderzoekRecords}, ` +
      `genormaliseerd=${normalisatie.genormaliseerd}, fouten=${normalisatie.fouten}.`,
    );
  }

  writeFileSync(nevenleveringBewijsPad, `${JSON.stringify({
    status: 'nevenlevering_bewezen_en_uitgesloten_van_objectimport',
    bronbestand: IN_ONDERZOEK_BRONBESTAND,
    bronpaden: [...inOnderzoekBronpaden].sort(),
    records: inOnderzoekRecords,
    closureGeselecteerdeRecords: closure.geselecteerdeRecords,
    importeerbareObjectrecords: importeerbareSelectie,
    reden: 'InOnderzoek is een landelijke BAG-nevenlevering en geen zelfstandig BAG-objecttype voor de objectadapter.',
    databaseImportUitgevoerd: false,
    supabaseBenaderd: false,
  }, null, 2)}\n`, 'utf-8');

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

  const bestanden: AmsterdamImportBestandsTelling[] = Object.entries(csvExport.bestanden).map(([naam, bewijs]) => ({
    bestand: bewijs.pad.split('/').at(-1) ?? naam,
    tabel: TABELPERBESTAND[naam] ?? 'quarantaine',
    regels: bewijs.regels,
    sha256: bewijs.sha256,
  }));
  bestanden.push({
    bestand: 'adapter-fouten.jsonl',
    tabel: 'quarantaine',
    regels: normalisatie.fouten,
    sha256: csvExport.bestanden.geometrieAfwijkingen.sha256,
  });

  const manifest = evalueerAmsterdamImportPakket({
    datasetVersie,
    scopeCode: '0363',
    geselecteerdAantal: importeerbareSelectie,
    selectieChecksum: closure.selectieChecksum,
    bronSha256: AMSTERDAM_BRON_SHA256,
    bestanden,
    samenvatting: {
      ontvangen: normalisatie.gelezen - inOnderzoekRecords,
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
    closureGeselecteerdeRecords: closure.geselecteerdeRecords,
    nevenleveringen: {
      inOnderzoek: {
        status: 'bewezen_en_uitgesloten_van_objectimport',
        bronbestand: IN_ONDERZOEK_BRONBESTAND,
        records: inOnderzoekRecords,
        bewijsbestand: nevenleveringBewijsPad,
      },
    },
    streaming: {
      normalisatie,
      sortering,
      outputBytes: Object.values(csvExport.bestanden).reduce((som, bestand) => som + statSync(bestand.pad).size, 0),
    },
  }, null, 2)}\n`, 'utf-8');
  await rm(werkmap, { recursive: true, force: true });
  return { besluit: manifest.besluit, manifestPad };
}

if (process.argv[1]?.endsWith('bereid-amsterdam-import-streamend-voor.ts')) {
  const [ndjson, closure, output, werkmap] = process.argv.slice(2);
  bereidAmsterdamImportStreamendVoor(ndjson, closure, output, werkmap)
    .then(resultaat => console.log(`besluit=${resultaat.besluit} manifest=${resultaat.manifestPad}`))
    .catch(error => {
      console.error(String(error));
      process.exit(1);
    });
}
