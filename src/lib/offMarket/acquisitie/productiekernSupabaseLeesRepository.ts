import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
  PrintbatchBriefContract,
  PrintbatchContract,
} from './productiekernContract';
import { bewaakBriefLeesIntegriteit } from './productiekernBriefLeesIntegriteit';
import { bewaakBriefversieLeesIntegriteit } from './productiekernBriefversieLeesIntegriteit';
import { bewaakDossierLeesIntegriteit } from './productiekernDossierLeesIntegriteit';
import {
  bewaakBriefversiesVoorGevraagdeBrief,
  bewaakGevraagdeLeesIdentiteit,
} from './productiekernLeesIdentiteit';
import {
  bewaakBriefLeesTijd,
  bewaakBriefversieLeesTijd,
  bewaakDossierLeesTijd,
  bewaakPrintbatchLeesTijd,
} from './productiekernLeesTijdSamenhang';
import { bewaakPrintbatchLeesIntegriteit } from './productiekernPrintbatchLeesIntegriteit';
import {
  ProductiekernNietGeactiveerdError,
  type AcquisitieProductiekernRepository,
} from './productiekernRepository';
import { bewaakBriefversieSnapshotLimiet } from './productiekernSnapshotLeesLimiet';
import {
  mapAcquisitiedossierRij,
  mapBriefRij,
  mapBriefversieRij,
  mapPrintbatchBriefRij,
  mapPrintbatchRij,
} from './productiekernSupabaseRijMapper';

export interface ProductiekernSupabaseLeesTransport {
  haalEen(tabel: string, filters: Readonly<Record<string, string>>): Promise<Record<string, unknown> | null>;
  haalMeerdere(
    tabel: string,
    filters: Readonly<Record<string, string>>,
    volgorde?: Readonly<{ kolom: string; oplopend: boolean }>,
  ): Promise<Record<string, unknown>[]>;
  haalMeerdereOpIds?(
    tabel: 'off_market_brieven' | 'off_market_brief_versies',
    ids: readonly string[],
  ): Promise<Record<string, unknown>[]>;
}

/**
 * Transitieve compatibiliteitsgrens voor de bestaande brieventabel.
 */
export function isFormeleProductiekernBriefRij(rij: Record<string, unknown>): boolean {
  if (rij.status === 'verstuurd') return false;
  return typeof rij.selectie_id === 'string' && rij.selectie_id.trim().length > 0;
}

export class SupabaseProductiekernLeesRepository implements AcquisitieProductiekernRepository {
  constructor(private readonly transport: ProductiekernSupabaseLeesTransport) {}

  async haalDossier(selectieId: string): Promise<AcquisitiedossierContract | null> {
    const rij = await this.transport.haalEen('off_market_acquisitie_dossiers', { selectie_id: selectieId });
    if (!rij) return null;
    const dossier = bewaakDossierLeesTijd(
      bewaakDossierLeesIntegriteit(mapAcquisitiedossierRij(rij)),
    );
    bewaakGevraagdeLeesIdentiteit('Acquisitiedossier', selectieId, dossier.selectieId);
    return dossier;
  }

  async haalBrief(briefId: string): Promise<BriefContract | null> {
    const rij = await this.transport.haalEen('off_market_brieven', { id: briefId });
    if (!rij || !isFormeleProductiekernBriefRij(rij)) return null;
    const brief = bewaakBriefLeesTijd(
      bewaakBriefLeesIntegriteit(mapBriefRij(rij)),
    );
    bewaakGevraagdeLeesIdentiteit('Brief', briefId, brief.id);
    return brief;
  }

  async haalBriefversies(briefId: string): Promise<BriefversieContract[]> {
    const rijen = await this.transport.haalMeerdere(
      'off_market_brief_versies',
      { brief_id: briefId },
      { kolom: 'versienummer', oplopend: true },
    );
    const versies = bewaakBriefversieLeesIntegriteit(
      rijen
        .map(mapBriefversieRij)
        .map((versie) => bewaakBriefversieSnapshotLimiet(versie))
        .map((versie) => bewaakBriefversieLeesTijd(versie)),
    );
    bewaakBriefversiesVoorGevraagdeBrief(briefId, versies.map((versie) => versie.briefId));
    return versies;
  }

  async haalPrintbatch(batchId: string): Promise<PrintbatchContract | null> {
    const rij = await this.transport.haalEen('off_market_printbatches', { id: batchId });
    if (!rij) return null;
    const batch = bewaakPrintbatchLeesTijd(
      bewaakPrintbatchLeesIntegriteit(mapPrintbatchRij(rij)),
    );
    bewaakGevraagdeLeesIdentiteit('Printbatch', batchId, batch.id);
    return batch;
  }

  async haalPrintbatchBrieven(batchId: string): Promise<PrintbatchBriefContract[]> {
    const rijen = await this.transport.haalMeerdere(
      'off_market_printbatch_brieven',
      { batch_id: batchId },
      { kolom: 'created_at', oplopend: true },
    );
    const koppelingen = rijen.map(mapPrintbatchBriefRij);
    for (const koppeling of koppelingen) {
      bewaakGevraagdeLeesIdentiteit('Printbatchbrief', batchId, koppeling.batchId);
    }
    return koppelingen.filter((koppeling) => koppeling.verwijderdOp === null);
  }

  /**
   * Herstelt de canonieke actieve BAT voor een set immutable briefversies.
   * Geen koppeling betekent nog geen BAT. Een gedeeltelijke scope, meerdere
   * actieve koppelingen voor één versie of meerdere BAT's is juist verdacht en
   * wordt fail-closed geblokkeerd in plaats van stil een nieuwe BAT te maken.
   */
  async haalActievePrintbatchIdVoorBriefversies(briefVersieIds: readonly string[]): Promise<string | null> {
    const ids = [...new Set(briefVersieIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (ids.length === 0) return null;

    const gevonden: Array<{ versieId: string; batchId: string | null }> = [];
    for (const versieId of ids) {
      const rijen = await this.transport.haalMeerdere(
        'off_market_printbatch_brieven',
        { brief_versie_id: versieId },
        { kolom: 'created_at', oplopend: true },
      );
      const actief = rijen
        .map(mapPrintbatchBriefRij)
        .filter((koppeling) => koppeling.verwijderdOp === null);
      if (actief.length > 1) {
        throw new Error(`Briefversie ${versieId} zit in meerdere actieve printbatches.`);
      }
      if (actief[0] && actief[0].briefVersieId !== versieId) {
        throw new Error('Teruggelezen printbatchkoppeling wijkt af van de gevraagde briefversie.');
      }
      gevonden.push({ versieId, batchId: actief[0]?.batchId ?? null });
    }

    const metBatch = gevonden.filter((item) => item.batchId !== null);
    if (metBatch.length === 0) return null;
    if (metBatch.length !== gevonden.length) {
      throw new Error('Definitieve brieven zijn slechts gedeeltelijk aan een actieve printbatch gekoppeld.');
    }
    const batchIds = new Set(metBatch.map((item) => item.batchId!));
    if (batchIds.size !== 1) {
      throw new Error('Definitieve brieven zijn verdeeld over meerdere actieve printbatches.');
    }
    return [...batchIds][0];
  }

  private schrijfpadGeblokkeerd<T>(handeling: string): Promise<T> {
    return Promise.reject(new ProductiekernNietGeactiveerdError(handeling));
  }

  startVerwerking(): Promise<AcquisitiedossierContract> { return this.schrijfpadGeblokkeerd('startVerwerking'); }
  reserveerBrief(): Promise<BriefContract> { return this.schrijfpadGeblokkeerd('reserveerBrief'); }
  maakBriefversie(): Promise<BriefversieContract> { return this.schrijfpadGeblokkeerd('maakBriefversie'); }
  maakPrintbatch(): Promise<PrintbatchContract> { return this.schrijfpadGeblokkeerd('maakPrintbatch'); }
  voegBriefversieToeAanBatch(): Promise<void> { return this.schrijfpadGeblokkeerd('voegBriefversieToeAanBatch'); }
  markeerBatchGeprint(): Promise<PrintbatchContract> { return this.schrijfpadGeblokkeerd('markeerBatchGeprint'); }
  markeerBriefGepost(): Promise<void> { return this.schrijfpadGeblokkeerd('markeerBriefGepost'); }
}
