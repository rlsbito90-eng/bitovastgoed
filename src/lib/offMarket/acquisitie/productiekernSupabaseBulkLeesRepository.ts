import type { AcquisitiedossierContract, BriefContract, BriefversieContract } from './productiekernContract';
import { bewaakBriefLeesIntegriteit } from './productiekernBriefLeesIntegriteit';
import { bewaakDossierLeesIntegriteit } from './productiekernDossierLeesIntegriteit';
import { bewaakBriefLeesTijd, bewaakBriefversieLeesTijd } from './productiekernLeesTijdSamenhang';
import { bewaakBriefversieSnapshotLimiet } from './productiekernSnapshotLeesLimiet';
import {
  isFormeleProductiekernBriefRij,
  type ProductiekernSupabaseLeesTransport,
} from './productiekernSupabaseLeesRepository';
import { mapAcquisitiedossierRij, mapBriefRij, mapBriefversieRij } from './productiekernSupabaseRijMapper';

export interface ProductiekernBulkLeesRepository {
  haalDossiersOpSelectieIds(selectieIds: readonly string[]): Promise<AcquisitiedossierContract[]>;
  haalBrievenOpIds(ids: readonly string[]): Promise<BriefContract[]>;
  haalBriefversiesOpIds(ids: readonly string[]): Promise<BriefversieContract[]>;
  haalBriefversiesOpBriefIds(briefIds: readonly string[]): Promise<BriefversieContract[]>;
}

function bewaakExacteIds(entiteit: string, gevraagd: readonly string[], gevonden: readonly string[]): void {
  const gevraagdSet = new Set(gevraagd);
  const gevondenSet = new Set(gevonden);
  if (gevondenSet.size !== gevonden.length) throw new Error(`${entiteit}-bulkread bevat dubbele records.`);
  for (const id of gevondenSet) {
    if (!gevraagdSet.has(id)) throw new Error(`${entiteit}-bulkread bevat een onverwacht ID.`);
  }
}

export class SupabaseProductiekernBulkLeesRepository implements ProductiekernBulkLeesRepository {
  constructor(private readonly transport: ProductiekernSupabaseLeesTransport) {}

  private eisBulktransport() {
    if (!this.transport.haalMeerdereOpIds) {
      throw new Error('Productiekern-bulktransport is niet aangesloten.');
    }
    return this.transport.haalMeerdereOpIds.bind(this.transport);
  }

  async haalDossiersOpSelectieIds(selectieIds: readonly string[]): Promise<AcquisitiedossierContract[]> {
    if (selectieIds.length === 0) return [];
    const rijen = await this.eisBulktransport()('off_market_acquisitie_dossiers', selectieIds);
    const dossiers = rijen
      .map(mapAcquisitiedossierRij)
      .map(bewaakDossierLeesIntegriteit);
    bewaakExacteIds('Acquisitiedossier', selectieIds, dossiers.map((dossier) => dossier.selectieId));
    return dossiers;
  }

  async haalBrievenOpIds(ids: readonly string[]): Promise<BriefContract[]> {
    if (ids.length === 0) return [];
    const rijen = await this.eisBulktransport()('off_market_brieven', ids);
    const brieven = rijen
      .filter(isFormeleProductiekernBriefRij)
      .map(mapBriefRij)
      .map((brief) => bewaakBriefLeesTijd(bewaakBriefLeesIntegriteit(brief)));
    bewaakExacteIds('Brief', ids, brieven.map((brief) => brief.id));
    return brieven;
  }

  async haalBriefversiesOpIds(ids: readonly string[]): Promise<BriefversieContract[]> {
    if (ids.length === 0) return [];
    const rijen = await this.eisBulktransport()('off_market_brief_versies', ids);
    const versies = rijen
      .map(mapBriefversieRij)
      .map((versie) => bewaakBriefversieSnapshotLimiet(versie))
      .map((versie) => bewaakBriefversieLeesTijd(versie));
    bewaakExacteIds('Briefversie', ids, versies.map((versie) => versie.id));
    return versies;
  }

  async haalBriefversiesOpBriefIds(briefIds: readonly string[]): Promise<BriefversieContract[]> {
    if (briefIds.length === 0) return [];
    if (!this.transport.haalMeerdereOpKolomIds) {
      throw new Error('Productiekern-bulktransport op briefscope is niet aangesloten.');
    }
    const rijen = await this.transport.haalMeerdereOpKolomIds('off_market_brief_versies', 'brief_id', briefIds);
    const gevraagd = new Set(briefIds);
    const versies = rijen
      .map(mapBriefversieRij)
      .map((versie) => bewaakBriefversieSnapshotLimiet(versie))
      .map((versie) => bewaakBriefversieLeesTijd(versie));
    const versieIds = new Set<string>();
    for (const versie of versies) {
      if (!gevraagd.has(versie.briefId)) throw new Error('Briefversie-bulkread bevat een versie buiten de gevraagde briefscope.');
      if (versieIds.has(versie.id)) throw new Error('Briefversie-bulkread bevat dubbele records.');
      versieIds.add(versie.id);
    }
    return versies;
  }
}
