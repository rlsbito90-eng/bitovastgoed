import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import { once } from 'node:events';

export interface AmsterdamChunkedSortOpties<TRecord> {
  invoerPad: string;
  uitvoerPad: string;
  werkmap: string;
  sleutel: (record: TRecord) => string;
  maxRecordsPerChunk?: number;
  verwijderChunksNaSamenvoegen?: boolean;
}

export interface AmsterdamChunkedSortResultaat {
  gelezen: number;
  geschreven: number;
  chunks: number;
  uitvoerPad: string;
  werkmap: string;
}

interface ChunkLezer<TRecord> {
  interface: Interface;
  iterator: AsyncIterator<string>;
  huidig: TRecord | null;
  huidigeRegel: string | null;
}

const STANDAARD_MAX_RECORDS_PER_CHUNK = 50_000;

async function schrijfTekst(stream: NodeJS.WritableStream, tekst: string): Promise<void> {
  if (!stream.write(tekst, 'utf-8')) await once(stream, 'drain');
}

async function sluitStream(stream: NodeJS.WritableStream): Promise<void> {
  stream.end();
  await once(stream, 'finish');
}

function vergelijkRecords<TRecord>(
  links: { record: TRecord; regel: string },
  rechts: { record: TRecord; regel: string },
  sleutel: (record: TRecord) => string,
): number {
  const sleutelVergelijking = sleutel(links.record).localeCompare(sleutel(rechts.record));
  return sleutelVergelijking || links.regel.localeCompare(rechts.regel);
}

async function schrijfChunk<TRecord>(
  records: TRecord[],
  chunkPad: string,
  sleutel: (record: TRecord) => string,
): Promise<void> {
  const gesorteerd = records
    .map(record => ({ record, regel: JSON.stringify(record) }))
    .sort((a, b) => vergelijkRecords(a, b, sleutel));
  const stream = createWriteStream(chunkPad, { encoding: 'utf-8' });
  try {
    for (const item of gesorteerd) await schrijfTekst(stream, `${item.regel}\n`);
  } finally {
    await sluitStream(stream);
  }
}

async function leesVolgende<TRecord>(lezer: ChunkLezer<TRecord>): Promise<void> {
  const volgende = await lezer.iterator.next();
  if (volgende.done) {
    lezer.huidig = null;
    lezer.huidigeRegel = null;
    return;
  }
  lezer.huidigeRegel = volgende.value;
  lezer.huidig = JSON.parse(volgende.value) as TRecord;
}

/**
 * Sorteert een NDJSON-spoolbestand met een begrensde hoeveelheid records in
 * geheugen. Eerst worden afzonderlijke gesorteerde chunks geschreven; daarna
 * volgt een deterministische k-way merge met slechts één actief record per chunk.
 */
export async function sorteerAmsterdamSpoolInChunks<TRecord>(
  opties: AmsterdamChunkedSortOpties<TRecord>,
): Promise<AmsterdamChunkedSortResultaat> {
  const invoerPad = resolve(opties.invoerPad);
  const uitvoerPad = resolve(opties.uitvoerPad);
  const werkmap = resolve(opties.werkmap);
  const maxRecordsPerChunk = opties.maxRecordsPerChunk ?? STANDAARD_MAX_RECORDS_PER_CHUNK;
  if (!Number.isInteger(maxRecordsPerChunk) || maxRecordsPerChunk < 1) {
    throw new Error('maxRecordsPerChunk moet een positief geheel getal zijn.');
  }

  await mkdir(werkmap, { recursive: true });
  await mkdir(dirname(uitvoerPad), { recursive: true });

  const chunkPaden: string[] = [];
  const buffer: TRecord[] = [];
  let gelezen = 0;
  const invoer = createInterface({ input: createReadStream(invoerPad, { encoding: 'utf-8' }), crlfDelay: Infinity });

  try {
    for await (const regel of invoer) {
      if (!regel.trim()) continue;
      buffer.push(JSON.parse(regel) as TRecord);
      gelezen += 1;
      if (buffer.length >= maxRecordsPerChunk) {
        const chunkPad = join(werkmap, `chunk-${String(chunkPaden.length + 1).padStart(6, '0')}.ndjson`);
        await schrijfChunk(buffer.splice(0), chunkPad, opties.sleutel);
        chunkPaden.push(chunkPad);
      }
    }
  } finally {
    invoer.close();
  }

  if (buffer.length > 0) {
    const chunkPad = join(werkmap, `chunk-${String(chunkPaden.length + 1).padStart(6, '0')}.ndjson`);
    await schrijfChunk(buffer.splice(0), chunkPad, opties.sleutel);
    chunkPaden.push(chunkPad);
  }

  const uitvoer = createWriteStream(uitvoerPad, { encoding: 'utf-8' });
  const lezers: ChunkLezer<TRecord>[] = chunkPaden.map(chunkPad => {
    const readlineInterface = createInterface({ input: createReadStream(chunkPad, { encoding: 'utf-8' }), crlfDelay: Infinity });
    return { interface: readlineInterface, iterator: readlineInterface[Symbol.asyncIterator](), huidig: null, huidigeRegel: null };
  });
  let geschreven = 0;

  try {
    await Promise.all(lezers.map(lezer => leesVolgende(lezer)));
    while (true) {
      let gekozenIndex = -1;
      for (let index = 0; index < lezers.length; index += 1) {
        const kandidaat = lezers[index];
        if (!kandidaat.huidig || kandidaat.huidigeRegel === null) continue;
        if (gekozenIndex < 0) {
          gekozenIndex = index;
          continue;
        }
        const gekozen = lezers[gekozenIndex];
        if (vergelijkRecords(
          { record: kandidaat.huidig, regel: kandidaat.huidigeRegel },
          { record: gekozen.huidig as TRecord, regel: gekozen.huidigeRegel as string },
          opties.sleutel,
        ) < 0) gekozenIndex = index;
      }
      if (gekozenIndex < 0) break;
      const gekozen = lezers[gekozenIndex];
      await schrijfTekst(uitvoer, `${gekozen.huidigeRegel}\n`);
      geschreven += 1;
      await leesVolgende(gekozen);
    }
  } finally {
    for (const lezer of lezers) lezer.interface.close();
    await sluitStream(uitvoer);
  }

  if (opties.verwijderChunksNaSamenvoegen ?? true) {
    await Promise.all(chunkPaden.map(chunkPad => rm(chunkPad, { force: true })));
  }

  return { gelezen, geschreven, chunks: chunkPaden.length, uitvoerPad, werkmap };
}
