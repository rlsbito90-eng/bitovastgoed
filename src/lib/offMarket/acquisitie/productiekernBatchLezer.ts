import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import type { ProductiekernBatchBrief } from './productiekernPrintbatch';
import type { PrintbatchContract } from './productiekernContract';

export interface GeladenProductiekernBatch {
  batch: PrintbatchContract;
  brieven: ProductiekernBatchBrief[];
}

/**
 * Leest een bestaande BAT terug vanuit uitsluitend Productiekern-tabellen en
 * reconstrueert exact de gekoppelde immutable briefversies. Verwijderde
 * koppelingen worden genegeerd; ontbrekende of gedrifte data blokkeert.
 */
export async function laadProductiekernBatch(
  batchId: string,
  repository: Pick<
    AcquisitieProductiekernRepository,
    'haalPrintbatch' | 'haalPrintbatchBrieven' | 'haalBrief' | 'haalBriefversies'
  >,
): Promise<GeladenProductiekernBatch> {
  if (!batchId.trim()) throw new Error('Batch-ID is verplicht.');

  const [batch, koppelingen] = await Promise.all([
    repository.haalPrintbatch(batchId),
    repository.haalPrintbatchBrieven(batchId),
  ]);
  if (!batch) throw new Error('Printbatch kon niet worden teruggelezen.');
  if (batch.id !== batchId) throw new Error('Teruggelezen printbatch wijkt af van de gevraagde batch.');

  const actief = koppelingen.filter((koppeling) => !koppeling.verwijderdOp);
  if (actief.length === 0) throw new Error('Printbatch bevat geen actieve briefkoppelingen.');

  const briefIds = new Set<string>();
  const versieIds = new Set<string>();
  for (const koppeling of actief) {
    if (koppeling.batchId !== batchId) throw new Error('Batchkoppeling hoort bij een andere printbatch.');
    if (briefIds.has(koppeling.briefId)) throw new Error(`Brief dubbel gekoppeld in printbatch: ${koppeling.briefId}.`);
    if (versieIds.has(koppeling.briefVersieId)) throw new Error(`Briefversie dubbel gekoppeld in printbatch: ${koppeling.briefVersieId}.`);
    briefIds.add(koppeling.briefId);
    versieIds.add(koppeling.briefVersieId);
  }

  const brieven = await Promise.all(actief.map(async (koppeling): Promise<ProductiekernBatchBrief> => {
    const [brief, versies] = await Promise.all([
      repository.haalBrief(koppeling.briefId),
      repository.haalBriefversies(koppeling.briefId),
    ]);
    if (!brief) throw new Error(`Brief ${koppeling.briefId} ontbreekt in de Productiekern.`);
    if (brief.status !== 'definitief' || !brief.briefnummer?.trim()) {
      throw new Error(`Brief ${brief.id} is niet definitief of mist een BR-nummer.`);
    }
    if (brief.id !== koppeling.briefId) throw new Error('Teruggelezen brief wijkt af van batchkoppeling.');

    const versie = versies.find((v) => v.id === koppeling.briefVersieId);
    if (!versie) throw new Error(`Gekoppelde briefversie ${koppeling.briefVersieId} ontbreekt.`);
    if (versie.briefId !== brief.id) throw new Error('Gekoppelde briefversie hoort bij een andere brief.');
    if (versie.status !== 'actief') throw new Error(`Gekoppelde briefversie ${versie.id} is niet actief.`);
    if (brief.actieveVersie !== versie.versienummer) throw new Error(`Brief ${brief.id} heeft versie-drift.`);

    return {
      brief,
      versie,
      // Stabiele, uitsluitend interne sleutel. De formele versie-ID is uniek en
      // voorkomt afhankelijkheid van veranderlijke naam/adrestekst.
      geadresseerdeKey: `${brief.signaalId}|${versie.id}`,
    };
  }));

  brieven.sort((a, b) =>
    (a.brief.briefnummer ?? '').localeCompare(b.brief.briefnummer ?? '')
    || a.versie.id.localeCompare(b.versie.id));

  return { batch, brieven };
}
