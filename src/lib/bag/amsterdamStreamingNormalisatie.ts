import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { parseOfficieelBagRecord, type BagOfficieelAdapterRecord } from './officieleXmlRecordAdapter';

export interface AmsterdamBronregel {
  bronpad: string;
  xml: string;
}

export interface AmsterdamStreamingFout {
  regel: number;
  bronpad: string | null;
  code: string;
  reden: string;
}

export interface AmsterdamStreamingNormalisatieResultaat {
  gelezen: number;
  genormaliseerd: number;
  fouten: number;
  spoolPad: string;
  foutenPad: string;
}

export interface AmsterdamStreamingParserResultaat<TRecord> {
  record: TRecord | null;
  fouten: Array<{ code: string; reden: string }>;
}

export type AmsterdamStreamingParser<TRecord> = (
  bronregel: AmsterdamBronregel,
) => AmsterdamStreamingParserResultaat<TRecord>;

async function schrijfRegel(stream: NodeJS.WritableStream, waarde: unknown): Promise<void> {
  const regel = `${JSON.stringify(waarde)}\n`;
  if (!stream.write(regel, 'utf-8')) await once(stream, 'drain');
}

async function sluitStream(stream: NodeJS.WritableStream): Promise<void> {
  stream.end();
  await once(stream, 'finish');
}

/**
 * Leest een Amsterdam-NDJSON-bestand regel voor regel en schrijft geparseerde
 * records direct naar een spoolbestand. Er wordt bewust geen volledige recordset
 * in het geheugen opgebouwd.
 */
export async function normaliseerAmsterdamNdjsonStreamend<TRecord>(
  invoerPad: string,
  spoolPad: string,
  foutenPad: string,
  parser: AmsterdamStreamingParser<TRecord>,
): Promise<AmsterdamStreamingNormalisatieResultaat> {
  const invoer = resolve(invoerPad);
  const spool = resolve(spoolPad);
  const fouten = resolve(foutenPad);
  mkdirSync(dirname(spool), { recursive: true });
  mkdirSync(dirname(fouten), { recursive: true });

  const spoolStream = createWriteStream(spool, { encoding: 'utf-8' });
  const foutenStream = createWriteStream(fouten, { encoding: 'utf-8' });
  const regels = createInterface({
    input: createReadStream(invoer, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let gelezen = 0;
  let genormaliseerd = 0;
  let foutAantal = 0;

  try {
    for await (const regel of regels) {
      if (!regel.trim()) continue;
      gelezen += 1;

      let bronregel: AmsterdamBronregel;
      try {
        const kandidaat = JSON.parse(regel) as Partial<AmsterdamBronregel>;
        if (typeof kandidaat.bronpad !== 'string' || typeof kandidaat.xml !== 'string') {
          throw new Error('bronpad en xml zijn verplicht');
        }
        bronregel = { bronpad: kandidaat.bronpad, xml: kandidaat.xml };
      } catch (error) {
        foutAantal += 1;
        await schrijfRegel(foutenStream, {
          regel: gelezen,
          bronpad: null,
          code: 'ongeldige_ndjson',
          reden: String(error),
        } satisfies AmsterdamStreamingFout);
        continue;
      }

      const resultaat = parser(bronregel);
      for (const fout of resultaat.fouten) {
        foutAantal += 1;
        await schrijfRegel(foutenStream, {
          regel: gelezen,
          bronpad: bronregel.bronpad,
          code: fout.code,
          reden: fout.reden,
        } satisfies AmsterdamStreamingFout);
      }

      if (resultaat.record) {
        await schrijfRegel(spoolStream, resultaat.record);
        genormaliseerd += 1;
      }
    }
  } finally {
    regels.close();
    await Promise.all([sluitStream(spoolStream), sluitStream(foutenStream)]);
  }

  return {
    gelezen,
    genormaliseerd,
    fouten: foutAantal,
    spoolPad: spool,
    foutenPad: fouten,
  };
}

export function parseAmsterdamBronregel(
  bronregel: AmsterdamBronregel,
): AmsterdamStreamingParserResultaat<BagOfficieelAdapterRecord> {
  const resultaat = parseOfficieelBagRecord(bronregel.xml);
  return {
    record: resultaat.record,
    fouten: resultaat.fouten.map(fout => ({ code: fout.code, reden: fout.reden })),
  };
}
