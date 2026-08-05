import { describe, expect, it } from 'vitest';
import {
  AMSTERDAM_BRON_SHA256,
  AMSTERDAM_CHUNK_IDS,
  AMSTERDAM_CHUNK_STATUS,
  berekenMetadataSha256,
  voegAmsterdamMetadataChunksSamen,
  type AmsterdamChunkRapport,
  type AmsterdamMetadataChunk,
} from './amsterdamMetadataIndex';

const MANIFEST = 'a'.repeat(64);

function chunk(nummer: number, extra: Partial<AmsterdamMetadataChunk> = {}): AmsterdamMetadataChunk {
  const records = [
    {
      identificatie: `036310000000000${nummer}`,
      objecttype: 'Pand',
      gerelateerdeIdentificaties: [`036301000000000${nummer}`],
    },
  ];
  return {
    status: AMSTERDAM_CHUNK_STATUS,
    chunkId: `chunk-0${nummer}`,
    chunkTotaal: 8,
    bronSha256: AMSTERDAM_BRON_SHA256,
    manifestSha256: MANIFEST,
    metadataSha256: berekenMetadataSha256(records),
    brononderdelen: [`deel-${nummer}.xml`],
    records,
    ...extra,
  };
}

function rapport(chunks: readonly AmsterdamMetadataChunk[]): AmsterdamChunkRapport {
  return {
    bronSha256: AMSTERDAM_BRON_SHA256,
    manifestSha256: MANIFEST,
    chunks: chunks.map(item => ({
      chunkId: item.chunkId,
      metadataSha256: item.metadataSha256,
      records: item.records.length,
    })),
  };
}

const ALLE = AMSTERDAM_CHUNK_IDS.map((_, index) => chunk(index + 1));

describe('Amsterdam metadata-index', () => {
  it('voegt acht gevalideerde chunks samen', () => {
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks: ALLE, rapport: rapport(ALLE) });
    expect(resultaat.status).toBe('metadata_index_validated');
    expect(resultaat.index?.records).toHaveLength(8);
    expect(resultaat.index?.brononderdelen).toHaveLength(8);
    expect(resultaat.index?.indexSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is invoervolgorde-onafhankelijk', () => {
    const a = voegAmsterdamMetadataChunksSamen({ chunks: ALLE, rapport: rapport(ALLE) });
    const b = voegAmsterdamMetadataChunksSamen({ chunks: [...ALLE].reverse(), rapport: rapport(ALLE) });
    expect(b.index?.indexSha256).toBe(a.index?.indexSha256);
  });

  it('stopt bij een ontbrekende chunk', () => {
    const chunks = ALLE.slice(0, 7);
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks, rapport: rapport(chunks) });
    expect(resultaat.status).toBe('stop');
    expect(resultaat.fouten.map(f => f.code)).toContain('ontbrekende_chunk');
  });

  it('stopt bij een dubbele chunk', () => {
    const chunks = [...ALLE, chunk(3)];
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks, rapport: rapport(ALLE) });
    expect(resultaat.fouten.map(f => f.code)).toContain('dubbele_chunk');
  });

  it('stopt bij bronhashdrift', () => {
    const chunks = [...ALLE.slice(1), chunk(1, { bronSha256: 'b'.repeat(64) })];
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks, rapport: rapport(ALLE) });
    expect(resultaat.fouten.map(f => f.code)).toContain('bron_hash_drift');
  });

  it('stopt bij manifesthashdrift', () => {
    const chunks = [...ALLE.slice(1), chunk(1, { manifestSha256: 'c'.repeat(64) })];
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks, rapport: rapport(ALLE) });
    expect(resultaat.fouten.map(f => f.code)).toContain('manifest_hash_drift');
  });

  it('stopt bij metadatahashdrift', () => {
    const chunks = [...ALLE.slice(1), chunk(1, { metadataSha256: 'd'.repeat(64) })];
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks, rapport: rapport(chunks) });
    expect(resultaat.fouten.map(f => f.code)).toContain('metadata_hash_drift');
  });

  it('stopt bij overlappende brononderdelen', () => {
    const chunks = [...ALLE.slice(1), chunk(1, { brononderdelen: ['deel-2.xml'] })];
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks, rapport: rapport(ALLE) });
    expect(resultaat.fouten.map(f => f.code)).toContain('overlappend_brononderdeel');
  });

  it('stopt bij een afwijkende status', () => {
    const chunks = [...ALLE.slice(1), chunk(1, { status: 'metadata_chunk_draft' })];
    const resultaat = voegAmsterdamMetadataChunksSamen({ chunks, rapport: rapport(ALLE) });
    expect(resultaat.fouten.map(f => f.code)).toContain('ongeldige_status');
  });
});
