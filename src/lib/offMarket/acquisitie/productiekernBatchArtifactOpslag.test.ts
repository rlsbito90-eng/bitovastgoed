import { describe, expect, it, vi } from 'vitest';

import type { PrintbatchContract } from './productiekernContract';
import { PRODUCTIEKERN_STORAGE_BUCKET, uploadProductiekernBatchArtifacts } from './productiekernBatchArtifactOpslag';

const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026081601', status: 'concept', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null,
  geannuleerdOp: null, annuleringsreden: null,
};

/**
 * jsdom's Blob mist in sommige Node-runners nog `arrayBuffer()`, terwijl echte
 * browsers dit wel aanbieden. Vul alleen die ontbrekende test-API aan zodat de
 * productiecode exact dezelfde hashingroute blijft testen.
 */
function testBlob(tekst: string): Blob {
  const blob = new Blob([tekst]);
  if (typeof blob.arrayBuffer !== 'function') {
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      value: async () => new TextEncoder().encode(tekst).buffer,
    });
  }
  return blob;
}

function bestanden() {
  return [
    { documenttype: 'batchvoorblad' as const, bestandsnaam: 'BAT-v1-voorblad.pdf', blob: testBlob('a'), mimeType: 'application/pdf' as const },
    { documenttype: 'controlelijst' as const, bestandsnaam: 'BAT-v1-controlelijst.pdf', blob: testBlob('b'), mimeType: 'application/pdf' as const },
    { documenttype: 'brieven_pdf' as const, bestandsnaam: 'BAT-v1-brieven.pdf', blob: testBlob('c'), mimeType: 'application/pdf' as const },
    { documenttype: 'adreslabels' as const, bestandsnaam: 'BAT-v1-adreslabels.csv', blob: testBlob('d'), mimeType: 'text/csv' as const },
  ];
}

describe('uploadProductiekernBatchArtifacts', () => {
  it('uploadt exact vier bestanden naar één uniek eigen actor/batch/version/attempt-pad', async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const resultaat = await uploadProductiekernBatchArtifacts({
      batch,
      actorId: 'actor-1',
      attemptId: 'attempt-1',
      bestanden: bestanden(),
      aangemaaktOp: '2026-08-16T21:00:00.000Z',
    }, { upload });

    expect(upload).toHaveBeenCalledTimes(4);
    expect(upload.mock.calls.map(([input]) => input.pad)).toEqual([
      'actor-1/batch-1/v1/attempt-1/BAT-v1-voorblad.pdf',
      'actor-1/batch-1/v1/attempt-1/BAT-v1-controlelijst.pdf',
      'actor-1/batch-1/v1/attempt-1/BAT-v1-brieven.pdf',
      'actor-1/batch-1/v1/attempt-1/BAT-v1-adreslabels.csv',
    ]);
    expect(upload.mock.calls.every(([input]) => input.bucket === PRODUCTIEKERN_STORAGE_BUCKET)).toBe(true);
    expect(resultaat).toHaveLength(4);
    expect(resultaat.every((document) => document.status === 'actief')).toBe(true);
    expect(resultaat.every((document) => typeof document.metadata.sha256 === 'string')).toBe(true);
    expect(resultaat.every((document) => String(document.metadata.sha256).length === 64)).toBe(true);
  });

  it('stopt bij eerste uploadfout en registreert zelf niets', async () => {
    let teller = 0;
    const upload = vi.fn(async () => {
      teller += 1;
      return { error: teller === 2 ? { message: 'netwerk' } : null };
    });
    await expect(uploadProductiekernBatchArtifacts({
      batch, actorId: 'actor', attemptId: 'attempt', bestanden: bestanden(),
    }, { upload })).rejects.toThrow('netwerk');
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('weigert onveilige paden, ontbrekende documenten en niet-muteerbare batchstatussen vóór upload', async () => {
    const upload = vi.fn();
    await expect(uploadProductiekernBatchArtifacts({
      batch, actorId: '../actor', attemptId: 'attempt', bestanden: bestanden(),
    }, { upload })).rejects.toThrow('Actor-ID');
    await expect(uploadProductiekernBatchArtifacts({
      batch, actorId: 'actor', attemptId: 'attempt', bestanden: bestanden().slice(0, 3),
    }, { upload })).rejects.toThrow('Exact vier');
    await expect(uploadProductiekernBatchArtifacts({
      batch: { ...batch, status: 'geprint', printdatum: '2026-08-16T21:00:00Z' },
      actorId: 'actor', attemptId: 'attempt', bestanden: bestanden(),
    }, { upload })).rejects.toThrow('Batchstatus');
    expect(upload).not.toHaveBeenCalled();
  });
});
