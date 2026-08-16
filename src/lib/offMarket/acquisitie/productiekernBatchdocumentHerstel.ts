import type { BatchdocumentContract, PrintbatchContract } from './productiekernContract';
import { PRODUCTIEKERN_STORAGE_BUCKET } from './productiekernBatchArtifactOpslag';

const VERWACHTE_TYPEN = ['batchvoorblad', 'controlelijst', 'brieven_pdf', 'adreslabels'] as const;

function tekstMetadata(document: BatchdocumentContract, sleutel: string): string {
  const waarde = document.metadata[sleutel];
  if (typeof waarde !== 'string' || !waarde.trim()) {
    throw new Error(`Batchdocument ${document.id} mist metadata ${sleutel}.`);
  }
  return waarde.trim();
}

/**
 * Reconstrueert uitsluitend de formeel geregistreerde actieve documentset van
 * de actuele BAT-documentversie. Historische/vervallen sets worden genegeerd;
 * een incomplete, dubbele of naar een andere Storage-ref wijzende actieve set
 * blokkeert fysieke print/postacties fail-closed.
 */
export function bepaalActieveProductiekernBatchdocumenten(input: {
  batch: PrintbatchContract;
  documenten: readonly BatchdocumentContract[];
}): BatchdocumentContract[] {
  const { batch, documenten } = input;
  if (batch.status === 'concept') {
    if (documenten.some((document) => document.status === 'actief')) {
      throw new Error('Concept-BAT heeft onverwacht al actieve geregistreerde documenten.');
    }
    return [];
  }

  const actief = documenten.filter((document) =>
    document.status === 'actief' && document.documentversie === batch.documentversie);
  if (actief.length !== 4) {
    throw new Error(`BAT ${batch.batchnummer} vereist exact vier actieve documenten voor v${batch.documentversie}.`);
  }

  const gezien = new Set<string>();
  for (const document of actief) {
    if (document.batchId !== batch.id) throw new Error('Batchdocument hoort bij een andere BAT.');
    if (gezien.has(document.documenttype)) throw new Error(`Batchdocumenttype dubbel: ${document.documenttype}.`);
    gezien.add(document.documenttype);

    const bucket = tekstMetadata(document, 'bucket');
    const pad = tekstMetadata(document, 'pad');
    tekstMetadata(document, 'bestandsnaam');
    if (bucket !== PRODUCTIEKERN_STORAGE_BUCKET) throw new Error('Batchdocument verwijst naar een onverwachte Storage-bucket.');
    if (document.bestandReferentie !== `${bucket}/${pad}`) {
      throw new Error(`Storage-referentie wijkt af voor batchdocument ${document.id}.`);
    }
    if (!pad.includes(`/${batch.id}/v${batch.documentversie}/`)) {
      throw new Error(`Storage-pad wijkt af van BAT ${batch.batchnummer} v${batch.documentversie}.`);
    }
  }

  for (const type of VERWACHTE_TYPEN) {
    if (!gezien.has(type)) throw new Error(`Batchdocumenttype ontbreekt: ${type}.`);
  }

  return [...actief].sort((a, b) => {
    const ai = VERWACHTE_TYPEN.indexOf(a.documenttype as typeof VERWACHTE_TYPEN[number]);
    const bi = VERWACHTE_TYPEN.indexOf(b.documenttype as typeof VERWACHTE_TYPEN[number]);
    return ai - bi;
  });
}
