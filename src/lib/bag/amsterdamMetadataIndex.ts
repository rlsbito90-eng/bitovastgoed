import { createHash } from 'node:crypto';

export const AMSTERDAM_BRON_SHA256 =
  'fe2c5b7d7a264dd74ca7bfee72e7edd07d43dd99a90a34c8317e21ab6d79335c';
export const AMSTERDAM_CHUNK_IDS = [
  'chunk-01',
  'chunk-02',
  'chunk-03',
  'chunk-04',
  'chunk-05',
  'chunk-06',
  'chunk-07',
  'chunk-08',
] as const;
export const AMSTERDAM_CHUNK_STATUS = 'metadata_chunk_validated';
export const AMSTERDAM_METADATA_CONTRACTVERSIE = 'bag-amsterdam-metadata-index/1';

export interface AmsterdamMetadataRecord {
  identificatie: string;
  objecttype: string;
  gerelateerdeIdentificaties: string[];
}

export interface AmsterdamMetadataChunk {
  status: string;
  chunkId: string;
  chunkTotaal: number;
  bronSha256: string;
  manifestSha256: string;
  metadataSha256: string;
  brononderdelen: string[];
  records: AmsterdamMetadataRecord[];
}

export interface AmsterdamChunkRapport {
  bronSha256: string;
  manifestSha256: string;
  chunks: Array<{ chunkId: string; metadataSha256: string; records: number }>;
}

export interface AmsterdamMetadataFout {
  code:
    | 'ontbrekende_chunk'
    | 'dubbele_chunk'
    | 'onbekende_chunk'
    | 'ongeldige_status'
    | 'bron_hash_drift'
    | 'manifest_hash_drift'
    | 'metadata_hash_drift'
    | 'overlappend_brononderdeel'
    | 'leeg_chunkbestand';
  reden: string;
}

export interface AmsterdamMetadataIndex {
  contractversie: string;
  bronSha256: string;
  manifestSha256: string;
  chunks: number;
  brononderdelen: string[];
  records: AmsterdamMetadataRecord[];
  indexSha256: string;
}

export type AmsterdamMetadataSamenvoegResultaat =
  | { status: 'metadata_index_validated'; index: AmsterdamMetadataIndex; fouten: [] }
  | { status: 'stop'; index: null; fouten: AmsterdamMetadataFout[] };

function normaliseerRecord(record: AmsterdamMetadataRecord): AmsterdamMetadataRecord {
  return {
    identificatie: record.identificatie.trim(),
    objecttype: record.objecttype.trim(),
    gerelateerdeIdentificaties: [
      ...new Set(record.gerelateerdeIdentificaties.map(item => item.trim()).filter(Boolean)),
    ].sort(),
  };
}

/** Deterministische, technologie-onafhankelijke canonicalisatie van metadataregels. */
export function canonicaliseerMetadata(records: readonly AmsterdamMetadataRecord[]): string {
  return records
    .map(normaliseerRecord)
    .map(record => `${record.identificatie}\t${record.objecttype}\t${record.gerelateerdeIdentificaties.join(',')}`)
    .sort()
    .join('\n');
}

export function berekenMetadataSha256(records: readonly AmsterdamMetadataRecord[]): string {
  return createHash('sha256').update(canonicaliseerMetadata(records), 'utf-8').digest('hex');
}

export function voegAmsterdamMetadataChunksSamen(invoer: {
  chunks: readonly AmsterdamMetadataChunk[];
  rapport: AmsterdamChunkRapport;
  verwachtBronSha256?: string;
}): AmsterdamMetadataSamenvoegResultaat {
  const verwachtBron = invoer.verwachtBronSha256 ?? AMSTERDAM_BRON_SHA256;
  const fouten: AmsterdamMetadataFout[] = [];

  if (invoer.rapport.bronSha256 !== verwachtBron) {
    fouten.push({
      code: 'bron_hash_drift',
      reden: `Rapport meldt bron_sha256 ${invoer.rapport.bronSha256} in plaats van ${verwachtBron}.`,
    });
  }

  const gezien = new Map<string, number>();
  for (const chunk of invoer.chunks) {
    gezien.set(chunk.chunkId, (gezien.get(chunk.chunkId) ?? 0) + 1);
  }
  for (const chunkId of AMSTERDAM_CHUNK_IDS) {
    const aantal = gezien.get(chunkId) ?? 0;
    if (aantal === 0) fouten.push({ code: 'ontbrekende_chunk', reden: `${chunkId} ontbreekt.` });
    if (aantal > 1) fouten.push({ code: 'dubbele_chunk', reden: `${chunkId} komt ${aantal} keer voor.` });
  }
  for (const chunkId of gezien.keys()) {
    if (!(AMSTERDAM_CHUNK_IDS as readonly string[]).includes(chunkId)) {
      fouten.push({ code: 'onbekende_chunk', reden: `${chunkId} hoort niet bij chunk-01 t/m chunk-08.` });
    }
  }

  const brononderdelen = new Map<string, string>();
  for (const chunk of invoer.chunks) {
    if (chunk.status !== AMSTERDAM_CHUNK_STATUS) {
      fouten.push({ code: 'ongeldige_status', reden: `${chunk.chunkId} heeft status ${chunk.status}.` });
    }
    if (chunk.bronSha256 !== verwachtBron) {
      fouten.push({ code: 'bron_hash_drift', reden: `${chunk.chunkId} meldt bron_sha256 ${chunk.bronSha256}.` });
    }
    if (chunk.manifestSha256 !== invoer.rapport.manifestSha256) {
      fouten.push({
        code: 'manifest_hash_drift',
        reden: `${chunk.chunkId} meldt manifest_sha256 ${chunk.manifestSha256} in plaats van ${invoer.rapport.manifestSha256}.`,
      });
    }
    if (chunk.records.length === 0) {
      fouten.push({ code: 'leeg_chunkbestand', reden: `${chunk.chunkId} bevat geen metadataregels.` });
    }

    const herberekend = berekenMetadataSha256(chunk.records);
    const gerapporteerd = invoer.rapport.chunks.find(item => item.chunkId === chunk.chunkId);
    if (herberekend !== chunk.metadataSha256) {
      fouten.push({
        code: 'metadata_hash_drift',
        reden: `${chunk.chunkId}: herberekende metadata_sha256 ${herberekend} wijkt af van ${chunk.metadataSha256}.`,
      });
    }
    if (!gerapporteerd) {
      fouten.push({ code: 'metadata_hash_drift', reden: `${chunk.chunkId} staat niet in het validatierapport.` });
    } else {
      if (gerapporteerd.metadataSha256 !== chunk.metadataSha256) {
        fouten.push({
          code: 'metadata_hash_drift',
          reden: `${chunk.chunkId}: rapport meldt ${gerapporteerd.metadataSha256}.`,
        });
      }
      if (gerapporteerd.records !== chunk.records.length) {
        fouten.push({
          code: 'metadata_hash_drift',
          reden: `${chunk.chunkId}: rapport meldt ${gerapporteerd.records} regels, chunk bevat ${chunk.records.length}.`,
        });
      }
    }

    for (const onderdeel of chunk.brononderdelen) {
      const eerder = brononderdelen.get(onderdeel);
      if (eerder && eerder !== chunk.chunkId) {
        fouten.push({
          code: 'overlappend_brononderdeel',
          reden: `${onderdeel} komt voor in ${eerder} en ${chunk.chunkId}.`,
        });
      } else {
        brononderdelen.set(onderdeel, chunk.chunkId);
      }
    }
  }

  if (fouten.length > 0) return { status: 'stop', index: null, fouten };

  const samengevoegd = new Map<string, AmsterdamMetadataRecord>();
  for (const chunk of invoer.chunks) {
    for (const ruw of chunk.records) {
      const record = normaliseerRecord(ruw);
      const bestaand = samengevoegd.get(record.identificatie);
      if (!bestaand) {
        samengevoegd.set(record.identificatie, record);
        continue;
      }
      samengevoegd.set(record.identificatie, {
        identificatie: record.identificatie,
        objecttype: bestaand.objecttype || record.objecttype,
        gerelateerdeIdentificaties: [
          ...new Set([...bestaand.gerelateerdeIdentificaties, ...record.gerelateerdeIdentificaties]),
        ].sort(),
      });
    }
  }

  const records = [...samengevoegd.values()].sort((a, b) => a.identificatie.localeCompare(b.identificatie));
  return {
    status: 'metadata_index_validated',
    fouten: [],
    index: {
      contractversie: AMSTERDAM_METADATA_CONTRACTVERSIE,
      bronSha256: verwachtBron,
      manifestSha256: invoer.rapport.manifestSha256,
      chunks: invoer.chunks.length,
      brononderdelen: [...brononderdelen.keys()].sort(),
      records,
      indexSha256: berekenMetadataSha256(records),
    },
  };
}
