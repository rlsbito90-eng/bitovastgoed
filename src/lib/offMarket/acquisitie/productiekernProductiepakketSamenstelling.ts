import type { BatchAdreslabelRij } from './batchAdreslabelRijen';
import type { BatchControlelijst } from './batchControlelijst';
import type { BatchProductiepakketManifest } from './batchProductiepakket';
import type { BatchVoorbladModel } from './batchVoorblad';
import type { BriefRenderInvoer } from './briefRenderInvoer';

export interface ProductiekernProductiepakketPayload {
  manifest: BatchProductiepakketManifest;
  voorblad: BatchVoorbladModel;
  controlelijst: BatchControlelijst;
  labels: readonly BatchAdreslabelRij[];
  brieven: readonly BriefRenderInvoer[];
}

/**
 * Laat uitsluitend een volledig, onderling consistent productiekernpakket door.
 * Legacy conceptbrieven kunnen deze grens niet passeren omdat renderinvoer al
 * een formele definitieve brief + actieve productiekernversie vereist.
 */
export function bouwProductiekernProductiepakketPayload(input: ProductiekernProductiepakketPayload): ProductiekernProductiepakketPayload {
  const { manifest, voorblad, controlelijst, labels, brieven } = input;

  if (!manifest.gereedVoorRender) {
    throw new Error(`Productiepakket is niet rendergereed: ${manifest.blokkades.join(' ')}`);
  }
  if (manifest.batchnummer !== voorblad.batchnummer || manifest.batchnummer !== controlelijst.batchnummer) {
    throw new Error('Batchnummer is niet consistent in het productiepakket.');
  }
  if (manifest.documentversie !== voorblad.documentversie || manifest.documentversie !== controlelijst.documentversie) {
    throw new Error('Documentversie is niet consistent in het productiepakket.');
  }
  if (manifest.briefAantal !== brieven.length || manifest.briefAantal !== labels.length || manifest.briefAantal !== controlelijst.totaal) {
    throw new Error('Aantallen in het productiepakket zijn niet consistent.');
  }

  const manifestIds = manifest.briefVersieIds;
  const briefIds = brieven.map((brief) => brief.briefVersieId);
  const labelIds = labels.map((label) => label.briefVersieId);
  const controleIds = controlelijst.rijen.map((rij) => rij.briefVersieId);
  const gelijk = (a: readonly string[], b: readonly string[]) => JSON.stringify(a) === JSON.stringify(b);

  if (!gelijk(manifestIds, briefIds) || !gelijk(manifestIds, labelIds) || !gelijk(manifestIds, controleIds)) {
    throw new Error('Briefversies of volgorde wijken af binnen het productiepakket.');
  }
  if (new Set(manifestIds).size !== manifestIds.length) {
    throw new Error('Productiepakket bevat dubbele briefversies.');
  }

  return Object.freeze({
    manifest,
    voorblad,
    controlelijst,
    labels: Object.freeze([...labels]),
    brieven: Object.freeze([...brieven]),
  });
}
