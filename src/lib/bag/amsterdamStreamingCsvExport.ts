import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import type { BagOfficieelAdapterRecord } from './officieleXmlRecordAdapter';
import { maakVoorkomenSleutel } from './geometrieVoorkomenKoppeling';

type CsvValue = string | number | boolean | null;

interface GeteldeSchrijver {
  pad: string;
  stream: NodeJS.WritableStream;
  hash: ReturnType<typeof createHash>;
  regels: number;
}

export interface AmsterdamStreamingCsvExportResultaat {
  gelezen: number;
  objecten: number;
  voorkomens: number;
  relaties: number;
  geometrieen: number;
  geometrieAfwijkingen: number;
  outputDir: string;
  bestanden: Record<string, { pad: string; regels: number; sha256: string }>;
}

function csv(value: CsvValue): string {
  if (value == null) return '';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function datum(value: string | null): string | null {
  if (!value) return null;
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function objectSleutel(record: BagOfficieelAdapterRecord): string {
  return `${record.objecttype}\u0000${record.identificatie}`;
}

function voorkomenMetadata(record: BagOfficieelAdapterRecord) {
  return {
    objecttype: record.objecttype,
    identificatie: record.identificatie,
    voorkomenidentificatie: record.voorkomen.voorkomenidentificatie,
    beginGeldigheid: record.voorkomen.beginGeldigheid,
    eindGeldigheid: record.voorkomen.eindGeldigheid,
    tijdstipRegistratie: record.voorkomen.tijdstipRegistratie,
    eindRegistratie: record.voorkomen.eindRegistratie,
    tijdstipInactief: record.voorkomen.tijdstipInactief,
  };
}

function geometrieWkt(record: BagOfficieelAdapterRecord): string | null {
  const geometrie = record.geometrie;
  if (geometrie.vorm === 'geen' || !geometrie.dimensie || geometrie.coordinaten.length === 0) return null;
  if (geometrie.coordinaten.length % geometrie.dimensie !== 0) return null;

  const punten: Array<[number, number, number]> = [];
  for (let index = 0; index < geometrie.coordinaten.length; index += geometrie.dimensie) {
    const x = geometrie.coordinaten[index];
    const y = geometrie.coordinaten[index + 1];
    const z = geometrie.dimensie === 3 ? geometrie.coordinaten[index + 2] : 0;
    if (![x, y, z].every(Number.isFinite)) return null;
    punten.push([x, y, z]);
  }

  if (geometrie.vorm === 'punt') return punten[0] ? `POINT Z (${punten[0].join(' ')})` : null;
  if (punten.length < 3) return null;
  const eerste = punten[0];
  const laatste = punten.at(-1);
  if (!laatste || eerste.some((waarde, index) => waarde !== laatste[index])) punten.push([...eerste]);
  return punten.length >= 4 ? `POLYGON Z ((${punten.map(punt => punt.join(' ')).join(', ')}))` : null;
}

async function maakSchrijver(pad: string): Promise<GeteldeSchrijver> {
  await mkdir(dirname(pad), { recursive: true });
  return { pad, stream: createWriteStream(pad, { encoding: 'utf-8' }), hash: createHash('sha256'), regels: 0 };
}

async function schrijfRegel(schrijver: GeteldeSchrijver, regel: string): Promise<void> {
  const tekst = `${regel}\n`;
  schrijver.hash.update(tekst, 'utf-8');
  schrijver.regels += 1;
  if (!schrijver.stream.write(tekst, 'utf-8')) await once(schrijver.stream, 'drain');
}

async function sluitSchrijver(schrijver: GeteldeSchrijver): Promise<string> {
  schrijver.stream.end();
  await once(schrijver.stream, 'finish');
  return schrijver.hash.digest('hex');
}

/**
 * Zet een op objectidentiteit gesorteerd Amsterdam-spoolbestand regel voor regel
 * om naar BAG-import-CSV's. Alleen toestand voor het actuele object blijft in
 * geheugen; tellingen en hashes worden incrementeel opgebouwd.
 */
export async function exporteerAmsterdamSpoolNaarCsvStreamend(
  invoerPad: string,
  outputPad: string,
  opties: { datasetVersie?: string; scopeCode?: string } = {},
): Promise<AmsterdamStreamingCsvExportResultaat> {
  const input = resolve(invoerPad);
  const outputDir = resolve(outputPad);
  await mkdir(outputDir, { recursive: true });

  const schrijvers = {
    objecten: await maakSchrijver(resolve(outputDir, 'objecten.csv')),
    voorkomens: await maakSchrijver(resolve(outputDir, 'voorkomens.csv')),
    relaties: await maakSchrijver(resolve(outputDir, 'relaties.csv')),
    geometrieen: await maakSchrijver(resolve(outputDir, 'geometrieen.csv')),
    geometrieAfwijkingen: await maakSchrijver(resolve(outputDir, 'geometrie-koppelafwijkingen.jsonl')),
  };

  let gelezen = 0;
  let vorigeObjectSleutel: string | null = null;
  let actueleRelaties = new Set<string>();
  let geometrieVolgnummers = new Map<string, number>();
  const regels = createInterface({ input: createReadStream(input, { encoding: 'utf-8' }), crlfDelay: Infinity });

  try {
    for await (const regel of regels) {
      if (!regel.trim()) continue;
      const record = JSON.parse(regel) as BagOfficieelAdapterRecord;
      gelezen += 1;
      const huidigeObjectSleutel = objectSleutel(record);
      if (vorigeObjectSleutel && huidigeObjectSleutel.localeCompare(vorigeObjectSleutel) < 0) {
        throw new Error(`Spoolbestand is niet op objectidentiteit gesorteerd bij regel ${gelezen}.`);
      }

      if (huidigeObjectSleutel !== vorigeObjectSleutel) {
        await schrijfRegel(schrijvers.objecten, [record.objecttype, record.identificatie].map(csv).join(','));
        actueleRelaties = new Set<string>();
        geometrieVolgnummers = new Map<string, number>();
        vorigeObjectSleutel = huidigeObjectSleutel;
      }

      const voorkomenSleutel = maakVoorkomenSleutel(voorkomenMetadata(record));
      const uitgebreideVelden = {
        ...record.velden,
        tijdstipRegistratie: record.voorkomen.tijdstipRegistratie,
        eindRegistratie: record.voorkomen.eindRegistratie,
        tijdstipInactief: record.voorkomen.tijdstipInactief,
      };
      await schrijfRegel(schrijvers.voorkomens, [
        record.objecttype,
        record.identificatie,
        voorkomenSleutel,
        record.voorkomen.voorkomenidentificatie,
        record.voorkomen.eindGeldigheid == null && record.voorkomen.eindRegistratie == null,
        datum(record.voorkomen.beginGeldigheid),
        datum(record.voorkomen.eindGeldigheid),
        record.status,
        JSON.stringify(uitgebreideVelden),
      ].map(csv).join(','));

      for (const [relatietype, doelIds] of Object.entries(record.relaties)) {
        for (const doelId of [...doelIds].sort()) {
          const relatieSleutel = `${relatietype}\u0000${doelId}`;
          if (actueleRelaties.has(relatieSleutel)) continue;
          actueleRelaties.add(relatieSleutel);
          await schrijfRegel(schrijvers.relaties, [record.objecttype, record.identificatie, relatietype, doelId].map(csv).join(','));
        }
      }

      if (record.geometrie.vorm !== 'geen' && record.geometrie.coordinaten.length > 0) {
        const wkt = geometrieWkt(record);
        if (!wkt || record.voorkomen.voorkomenidentificatie == null) {
          await schrijfRegel(schrijvers.geometrieAfwijkingen, JSON.stringify({
            code: !wkt ? 'ongeldige_brongeometrie' : 'ontbrekende_voorkomenkoppeling',
            objecttype: record.objecttype,
            identificatie: record.identificatie,
            voorkomen: record.voorkomen,
            geometrie: record.geometrie,
          }));
        } else {
          const volgnummer = (geometrieVolgnummers.get(voorkomenSleutel) ?? 0) + 1;
          geometrieVolgnummers.set(voorkomenSleutel, volgnummer);
          await schrijfRegel(schrijvers.geometrieen, [
            record.objecttype,
            record.identificatie,
            voorkomenSleutel,
            record.voorkomen.voorkomenidentificatie,
            volgnummer,
            wkt,
          ].map(csv).join(','));
        }
      }
    }
  } finally {
    regels.close();
  }

  const bestanden: AmsterdamStreamingCsvExportResultaat['bestanden'] = {};
  for (const [naam, schrijver] of Object.entries(schrijvers)) {
    bestanden[naam] = { pad: schrijver.pad, regels: schrijver.regels, sha256: await sluitSchrijver(schrijver) };
  }

  const resultaat: AmsterdamStreamingCsvExportResultaat = {
    gelezen,
    objecten: schrijvers.objecten.regels,
    voorkomens: schrijvers.voorkomens.regels,
    relaties: schrijvers.relaties.regels,
    geometrieen: schrijvers.geometrieen.regels,
    geometrieAfwijkingen: schrijvers.geometrieAfwijkingen.regels,
    outputDir,
    bestanden,
  };

  await writeFile(resolve(outputDir, 'manifest.json'), `${JSON.stringify({
    status: 'streaming_csv_export_voltooid',
    datasetVersie: opties.datasetVersie ?? 'onbekend',
    scopeCode: opties.scopeCode ?? '0363',
    ...resultaat,
    database_write_uitgevoerd: false,
    supabase_benaderd: false,
    productie_benaderd: false,
  }, null, 2)}\n`, 'utf-8');

  return resultaat;
}
