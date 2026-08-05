import { createHash } from 'node:crypto';
import type { AmsterdamMetadataIndex, AmsterdamMetadataRecord } from './amsterdamMetadataIndex';

export const AMSTERDAM_GEMEENTECODE = '0363';
export const AMSTERDAM_CLOSURE_CONTRACTVERSIE = 'bag-amsterdam-closure/1';

export interface AmsterdamClosureInvoer {
  index: Pick<AmsterdamMetadataIndex, 'records' | 'indexSha256'>;
  gemeentecode?: string;
  maximumPasses?: number;
}

export interface AmsterdamClosureRapport {
  contractversie: string;
  gemeentecode: string;
  indexSha256: string;
  seeds: number;
  records: number;
  passes: number;
  maximumPasses: number;
  groeiPerPass: number[];
  geselecteerdeIds: string[];
  selectieChecksum: string;
}

export type AmsterdamClosureResultaat =
  | { status: 'closure_validated'; rapport: AmsterdamClosureRapport; fouten: [] }
  | {
      status: 'stop';
      rapport: AmsterdamClosureRapport | null;
      fouten: Array<{ code: 'geen_seeds' | 'geen_convergentie'; reden: string }>;
    };

function checksum(ids: readonly string[]): string {
  return createHash('sha256').update([...ids].sort().join('\n'), 'utf-8').digest('hex');
}

/**
 * Deterministische fixed-point closure: start bij alle records met de Amsterdamse
 * gemeentecode als prefix en voeg per pass uitsluitend gerelateerde identificaties toe
 * die in de gevalideerde metadata-index aanwezig zijn.
 */
export function berekenAmsterdamClosure(invoer: AmsterdamClosureInvoer): AmsterdamClosureResultaat {
  const gemeentecode = invoer.gemeentecode ?? AMSTERDAM_GEMEENTECODE;
  const maximumPasses = invoer.maximumPasses ?? 25;

  const perId = new Map<string, AmsterdamMetadataRecord>();
  for (const record of invoer.index.records) perId.set(record.identificatie, record);

  const seeds = [...perId.keys()].filter(id => id.startsWith(gemeentecode)).sort();
  if (seeds.length === 0) {
    return {
      status: 'stop',
      rapport: null,
      fouten: [{ code: 'geen_seeds', reden: `Geen records met gemeentecodeprefix ${gemeentecode}.` }],
    };
  }

  const geselecteerd = new Set<string>(seeds);
  let grens = [...seeds];
  const groeiPerPass: number[] = [];
  let passes = 0;
  let geconvergeerd = false;

  while (passes < maximumPasses) {
    passes += 1;
    const volgende: string[] = [];
    for (const id of grens) {
      const record = perId.get(id);
      if (!record) continue;
      for (const doel of record.gerelateerdeIdentificaties) {
        if (!perId.has(doel) || geselecteerd.has(doel)) continue;
        geselecteerd.add(doel);
        volgende.push(doel);
      }
    }
    groeiPerPass.push(volgende.length);
    if (volgende.length === 0) {
      geconvergeerd = true;
      break;
    }
    grens = volgende.sort();
  }

  const geselecteerdeIds = [...geselecteerd].sort();
  const rapport: AmsterdamClosureRapport = {
    contractversie: AMSTERDAM_CLOSURE_CONTRACTVERSIE,
    gemeentecode,
    indexSha256: invoer.index.indexSha256,
    seeds: seeds.length,
    records: geselecteerdeIds.length,
    passes,
    maximumPasses,
    groeiPerPass,
    geselecteerdeIds,
    selectieChecksum: checksum(geselecteerdeIds),
  };

  if (!geconvergeerd) {
    return {
      status: 'stop',
      rapport,
      fouten: [
        {
          code: 'geen_convergentie',
          reden: `Closure niet geconvergeerd binnen ${maximumPasses} passes; laatste groei ${groeiPerPass.at(-1)}.`,
        },
      ],
    };
  }

  return { status: 'closure_validated', rapport, fouten: [] };
}
