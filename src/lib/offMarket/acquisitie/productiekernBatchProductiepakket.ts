import { bouwBatchAdreslabelRijen } from './batchAdreslabelRijen';
import { bouwBatchControlelijst } from './batchControlelijst';
import { bouwBatchDocumentPlan } from './batchDocumentPlan';
import { bouwBatchProductiepakketManifest } from './batchProductiepakket';
import { bouwBatchVoorbladModel } from './batchVoorblad';
import { bouwBriefRenderInvoer } from './briefRenderInvoer';
import type { PrintbatchContract } from './productiekernContract';
import type { ProductiekernBatchBrief } from './productiekernPrintbatch';
import {
  bouwProductiekernProductiepakketPayload,
  type ProductiekernProductiepakketPayload,
} from './productiekernProductiepakketSamenstelling';

/**
 * Enige pure samenstellingsroute voor een BAT-productiepakket.
 *
 * Brondata zijn uitsluitend de formele printbatch plus de reeds gekoppelde,
 * definitieve immutable briefversies. Er wordt niets uit legacy tabellen
 * bijgelezen en er vindt geen Storage-, database-, print- of postmutatie plaats.
 */
export function bouwProductiekernBatchProductiepakket(input: {
  batch: PrintbatchContract;
  brieven: readonly ProductiekernBatchBrief[];
}): ProductiekernProductiepakketPayload {
  if (input.brieven.length === 0) {
    throw new Error('Productiepakket vereist minimaal één definitieve brief.');
  }

  const documentInvoer = input.brieven.map(({ brief, versie }) => {
    if (brief.status !== 'definitief' || !brief.briefnummer?.trim()) {
      throw new Error(`Brief ${brief.id} is niet definitief of mist een BR-nummer.`);
    }
    if (versie.briefId !== brief.id || versie.status !== 'actief') {
      throw new Error(`Briefversie ${versie.id} is niet de actieve versie van brief ${brief.id}.`);
    }
    if (brief.actieveVersie !== versie.versienummer) {
      throw new Error(`Actieve versie van brief ${brief.id} wijkt af.`);
    }
    return {
      briefnummer: brief.briefnummer,
      versie,
      // De legacy-bridge is alleen bereikbaar via de expliciete knop
      // “Definitief maken (BR)”, waarbij het verzendadres in de Focus zichtbaar
      // wordt bevestigd. Pas ná de definitief-check hierboven mag dit daarom als
      // handmatige adresbevestiging naar de controlelijst worden doorgegeven.
      adresHandmatigBevestigd: versie.geadresseerde.bron === 'legacy_concept',
    };
  });

  const plan = bouwBatchDocumentPlan({
    batch: input.batch,
    brieven: documentInvoer,
  });
  const controlelijst = bouwBatchControlelijst({
    batch: input.batch,
    brieven: documentInvoer,
  });
  const voorblad = bouwBatchVoorbladModel(input.batch, controlelijst);
  const labels = bouwBatchAdreslabelRijen(input.brieven.map(({ brief, versie }) => ({
    briefnummer: brief.briefnummer!,
    briefVersieId: versie.id,
    geadresseerde: versie.geadresseerde,
  })));
  const manifest = bouwBatchProductiepakketManifest({
    plan,
    controlelijst,
    voorblad,
    labels,
  });
  const brieven = input.brieven
    .map(({ brief, versie }) => bouwBriefRenderInvoer({ brief, versie }))
    .sort((a, b) => a.briefnummer.localeCompare(b.briefnummer) || a.briefVersieId.localeCompare(b.briefVersieId));

  return bouwProductiekernProductiepakketPayload({
    manifest,
    voorblad,
    controlelijst,
    labels,
    brieven,
  });
}
