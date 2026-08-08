import type { BriefContract, BriefversieContract } from './productiekernContract';
import { bewaakBriefLeesIntegriteit } from './productiekernBriefLeesIntegriteit';
import { bewaakBriefversieLeesIntegriteit } from './productiekernBriefversieLeesIntegriteit';
import { bewaakBriefLeesTijd, bewaakBriefversieLeesTijd } from './productiekernLeesTijdSamenhang';
import { bewaakBriefversieSnapshotLimiet } from './productiekernSnapshotLeesLimiet';
import {
  isFormeleProductiekernBriefRij,
  type ProductiekernSupabaseLeesTransport,
} from './productiekernSupabaseLeesRepository';
import { mapBriefRij, mapBriefversieRij } from './productiekernSupabaseRijMapper';

export interface ProductiekernBulkLeesRepository {
  haalBrievenOpIds(ids: readonly string[]): Promise<BriefContract[]>;
  haalBriefversiesOpIds(ids: readonly string[]): Promise<BriefversieContract[]>;
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
    const versies = bewaakBriefversieLeesIntegriteit(
      rijen
        .map(mapBriefversieRij)
        .map((versie) => bewaakBriefversieSnapshotLimiet(versie))
        .map((versie) => bewaakBriefversieLeesTijd(versie)),
    );
    bewaakExacteIds('Briefversie', ids, versies.map((versie) => versie.id));
    return versies;
  }
}
