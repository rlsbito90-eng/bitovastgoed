import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  voegAmsterdamMetadataChunksSamen,
  type AmsterdamChunkRapport,
  type AmsterdamMetadataChunk,
} from '../../src/lib/bag/amsterdamMetadataIndex';
import { berekenAmsterdamClosure } from '../../src/lib/bag/amsterdamClosure';

function json<T>(pad: string): T {
  return JSON.parse(readFileSync(pad, 'utf-8')) as T;
}

/**
 * Voegt de acht gevalideerde metadatachunks fail-closed samen en berekent daarna de
 * relationele closure op gemeentecode 0363. Schrijft één compacte metadata-index en
 * twee bewijsrapporten. Voert geen databaseactie uit.
 */
export function voerAmsterdamMetadataEnClosureUit(
  chunkMap: string,
  rapportPad: string,
  outputMap: string,
  maximumPasses = 25,
): { status: 'closure_validated' | 'stop'; outputDir: string } {
  const chunkDir = resolve(chunkMap);
  const outputDir = resolve(outputMap);
  mkdirSync(outputDir, { recursive: true });

  const bestanden = readdirSync(chunkDir)
    .filter(naam => naam.endsWith('.json'))
    .sort();
  const chunks = bestanden.map(naam => json<AmsterdamMetadataChunk>(resolve(chunkDir, naam)));
  const rapport = json<AmsterdamChunkRapport>(resolve(rapportPad));

  const samenvoeging = voegAmsterdamMetadataChunksSamen({ chunks, rapport });
  writeFileSync(
    resolve(outputDir, 'metadata-bewijs.json'),
    `${JSON.stringify({ status: samenvoeging.status, chunkbestanden: bestanden, fouten: samenvoeging.fouten, index: samenvoeging.index ? { ...samenvoeging.index, records: samenvoeging.index.records.length } : null }, null, 2)}\n`,
    'utf-8',
  );
  if (samenvoeging.status === 'stop' || !samenvoeging.index) {
    return { status: 'stop', outputDir };
  }

  const indexRegels = samenvoeging.index.records
    .map(record => `${record.identificatie}\t${record.objecttype}\t${record.gerelateerdeIdentificaties.join(',')}`)
    .join('\n');
  writeFileSync(resolve(outputDir, 'metadata-index.tsv'), `${indexRegels}\n`, 'utf-8');
  writeFileSync(
    resolve(outputDir, 'metadata-index.json'),
    `${JSON.stringify(samenvoeging.index, null, 2)}\n`,
    'utf-8',
  );

  const closure = berekenAmsterdamClosure({ index: samenvoeging.index, maximumPasses });
  writeFileSync(
    resolve(outputDir, 'closure-bewijs.json'),
    `${JSON.stringify({ status: closure.status, fouten: closure.fouten, rapport: closure.rapport }, null, 2)}\n`,
    'utf-8',
  );
  if (closure.status === 'closure_validated' && closure.rapport) {
    writeFileSync(
      resolve(outputDir, 'closure-selectie.txt'),
      `${closure.rapport.geselecteerdeIds.join('\n')}\n`,
      'utf-8',
    );
    writeFileSync(
      resolve(outputDir, 'closure-selectie.sha256'),
      `${createHash('sha256').update(closure.rapport.geselecteerdeIds.join('\n'), 'utf-8').digest('hex')}\n`,
      'utf-8',
    );
  }

  return { status: closure.status, outputDir };
}

if (process.argv[1] && process.argv[1].endsWith('amsterdam-metadata-en-closure.ts')) {
  const [chunkMap, rapportPad, outputMap] = process.argv.slice(2);
  if (!chunkMap || !rapportPad || !outputMap) {
    console.error('Gebruik: amsterdam-metadata-en-closure.ts <chunkmap> <validatierapport.json> <outputmap>');
    process.exit(2);
  }
  const resultaat = voerAmsterdamMetadataEnClosureUit(chunkMap, rapportPad, outputMap);
  console.log(`status=${resultaat.status} output=${resultaat.outputDir}`);
  process.exit(resultaat.status === 'closure_validated' ? 0 : 1);
}
