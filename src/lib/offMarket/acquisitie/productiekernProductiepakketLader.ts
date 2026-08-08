import { bouwBatchAdreslabelRijen } from './batchAdreslabelRijen';
import { bouwBatchControlelijst } from './batchControlelijst';
import { bouwBatchDocumentPlan } from './batchDocumentPlan';
import { bouwBatchProductiepakketManifest } from './batchProductiepakket';
import { bouwBatchVoorbladModel } from './batchVoorblad';
import { bouwBriefRenderInvoer } from './briefRenderInvoer';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';
import {
  bouwProductiekernProductiepakketPayload,
  type ProductiekernProductiepakketPayload,
} from './productiekernProductiepakketSamenstelling';
import type { ProductiekernBulkLeesRepository } from './productiekernSupabaseBulkLeesRepository';

export interface ProductiekernProductiepakketLeesbron {
  repository: Pick<AcquisitieProductiekernRepository, 'haalPrintbatch' | 'haalPrintbatchBrieven'>;
  bulkRepository: ProductiekernBulkLeesRepository;
}

/**
 * Bouwt één volledig renderpakket uit formele productiekernrecords met een
 * constant aantal reads: batch + batchkoppelingen + brievenbulk + versiebulk.
 * Geen enkele read wordt per brief herhaald.
 */
export async function laadProductiekernProductiepakket(
  batchId: string,
  bron: ProductiekernProductiepakketLeesbron,
): Promise<ProductiekernProductiepakketPayload | null> {
  const batch = await bron.repository.haalPrintbatch(batchId);
  if (!batch) return null;

  const koppelingen = await bron.repository.haalPrintbatchBrieven(batchId);
  if (koppelingen.length === 0) {
    throw new Error('Printbatch bevat geen actieve briefkoppelingen.');
  }

  const briefIds = koppelingen.map((koppeling) => koppeling.briefId);
  const versieIds = koppelingen.map((koppeling) => koppeling.briefVersieId);
  if (new Set(briefIds).size !== briefIds.length) {
    throw new Error('Printbatch bevat dezelfde brief meer dan één keer.');
  }
  if (new Set(versieIds).size !== versieIds.length) {
    throw new Error('Printbatch bevat dezelfde briefversie meer dan één keer.');
  }

  const [brieven, versies] = await Promise.all([
    bron.bulkRepository.haalBrievenOpIds(briefIds),
    bron.bulkRepository.haalBriefversiesOpIds(versieIds),
  ]);
  const briefPerId = new Map(brieven.map((brief) => [brief.id, brief]));
  const versiePerId = new Map(versies.map((versie) => [versie.id, versie]));

  const items = koppelingen.map((koppeling) => {
    const brief = briefPerId.get(koppeling.briefId);
    const versie = versiePerId.get(koppeling.briefVersieId);
    if (!brief) throw new Error(`Formele brief ontbreekt voor batchkoppeling ${koppeling.id}.`);
    if (!versie) throw new Error(`Briefversie ontbreekt voor batchkoppeling ${koppeling.id}.`);
    if (versie.briefId !== brief.id) throw new Error('Batchkoppeling verbindt een brief met een versie van een andere brief.');
    if (!brief.briefnummer) throw new Error(`Brief ${brief.id} mist een definitief briefnummer.`);
    const render = bouwBriefRenderInvoer({ brief, versie });
    return { briefnummer: brief.briefnummer, versie, render };
  }).sort((a, b) => a.briefnummer.localeCompare(b.briefnummer));

  const documentInvoer = items.map(({ briefnummer, versie }) => ({ briefnummer, versie }));
  const plan = bouwBatchDocumentPlan({ batch, brieven: documentInvoer });
  const controlelijst = bouwBatchControlelijst({ batch, brieven: documentInvoer });
  const labels = bouwBatchAdreslabelRijen(items.map(({ briefnummer, versie }) => ({
    briefnummer,
    briefVersieId: versie.id,
    geadresseerde: versie.geadresseerde,
  })));
  const voorblad = bouwBatchVoorbladModel(batch, controlelijst);
  const manifest = bouwBatchProductiepakketManifest({ plan, controlelijst, voorblad, labels });

  return bouwProductiekernProductiepakketPayload({
    manifest,
    voorblad,
    controlelijst,
    labels,
    brieven: items.map((item) => item.render),
  });
}
