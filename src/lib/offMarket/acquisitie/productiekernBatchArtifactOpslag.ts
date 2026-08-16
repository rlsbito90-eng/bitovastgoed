import type { BatchdocumentContract, PrintbatchContract } from './productiekernContract';

export const PRODUCTIEKERN_STORAGE_BUCKET = 'off-market-productie' as const;

export interface ProductiekernUploadBestand {
  documenttype: BatchdocumentContract['documenttype'];
  bestandsnaam: string;
  blob: Blob;
  mimeType: 'application/pdf' | 'text/csv';
}

export interface ProductiekernStorageUitvoerder {
  upload(input: {
    bucket: typeof PRODUCTIEKERN_STORAGE_BUCKET;
    pad: string;
    blob: Blob;
    contentType: ProductiekernUploadBestand['mimeType'];
  }): Promise<{ error: { message?: string | null } | null }>;
}

function veiligPadSegment(waarde: string, veld: string): string {
  const schoon = waarde.trim();
  if (!schoon || schoon.includes('/') || schoon.includes('..')) {
    throw new Error(`${veld} is ongeldig voor Productiekern Storage.`);
  }
  return schoon;
}

async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploadt vier artifacts append-only naar een unieke attempt-map. Bestaande
 * objecten worden nooit overschreven; een mislukte poging kan hoogstens orphan
 * artifacts achterlaten en kan veilig met een nieuw attempt-ID worden herhaald.
 */
export async function uploadProductiekernBatchArtifacts(input: {
  batch: PrintbatchContract;
  actorId: string;
  attemptId: string;
  bestanden: readonly ProductiekernUploadBestand[];
  aangemaaktOp?: string;
}, storage: ProductiekernStorageUitvoerder): Promise<BatchdocumentContract[]> {
  if (input.batch.status !== 'concept' && input.batch.status !== 'documenten_gegenereerd') {
    throw new Error('Batchstatus blokkeert artifactopslag.');
  }
  const actorId = veiligPadSegment(input.actorId, 'Actor-ID');
  const batchId = veiligPadSegment(input.batch.id, 'Batch-ID');
  const attemptId = veiligPadSegment(input.attemptId, 'Attempt-ID');
  if (input.bestanden.length !== 4) throw new Error('Exact vier batchbestanden zijn verplicht.');

  const typen = new Set(input.bestanden.map((bestand) => bestand.documenttype));
  const namen = new Set(input.bestanden.map((bestand) => bestand.bestandsnaam));
  if (typen.size !== 4) throw new Error('Ieder batchdocumenttype moet exact één keer voorkomen.');
  if (namen.size !== 4) throw new Error('Batchbestandsnamen moeten uniek zijn.');

  const verwacht = new Set(['batchvoorblad', 'controlelijst', 'brieven_pdf', 'adreslabels']);
  if ([...typen].some((type) => !verwacht.has(type))) throw new Error('Onverwacht batchdocumenttype.');

  const aangemaaktOp = input.aangemaaktOp ?? new Date().toISOString();
  const basisPad = `${actorId}/${batchId}/v${input.batch.documentversie}/${attemptId}`;
  const resultaat: BatchdocumentContract[] = [];

  // Bewust sequentieel: bij een fout is exact bekend tot welk object de attempt
  // gekomen is. Een volgende poging gebruikt een nieuw attempt-ID.
  for (const bestand of input.bestanden) {
    const bestandsnaam = veiligPadSegment(bestand.bestandsnaam, 'Bestandsnaam');
    if (bestand.blob.size < 1) throw new Error(`Batchbestand ${bestandsnaam} is leeg.`);
    const pad = `${basisPad}/${bestandsnaam}`;
    const sha256 = await sha256Hex(bestand.blob);
    const respons = await storage.upload({
      bucket: PRODUCTIEKERN_STORAGE_BUCKET,
      pad,
      blob: bestand.blob,
      contentType: bestand.mimeType,
    });
    if (respons.error) {
      throw new Error(`Opslaan van ${bestandsnaam} mislukt: ${respons.error.message || 'onbekende Storage-fout'}`);
    }

    resultaat.push({
      id: crypto.randomUUID(),
      batchId: input.batch.id,
      documentversie: input.batch.documentversie,
      documenttype: bestand.documenttype,
      bestandReferentie: `${PRODUCTIEKERN_STORAGE_BUCKET}/${pad}`,
      status: 'actief',
      metadata: {
        bucket: PRODUCTIEKERN_STORAGE_BUCKET,
        pad,
        bestandsnaam,
        mime_type: bestand.mimeType,
        bestandsgrootte: bestand.blob.size,
        sha256,
        attempt_id: attemptId,
      },
      createdAt: aangemaaktOp,
      vervallenOp: null,
    });
  }

  return resultaat;
}
