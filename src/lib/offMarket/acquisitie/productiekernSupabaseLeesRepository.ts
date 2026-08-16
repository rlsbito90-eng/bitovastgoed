import type {
  AcquisitiedossierContract,
  BatchdocumentContract,
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
  mapBatchdocumentRij,
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
    tabel: 'off_market_brieven' | 'off_market_brief_versies' | 'off_market_printbatch_brieven',
    ids: readonly string[],
  ): Promise<Record<string, unknown>[]>;
}

export function isFormeleProductiekernBriefRij(rij: Record<string, unknown>): boolean {
  if (rij.status === 'verstuurd') return false;
  return typeof rij.selectie_id === 'string' && rij.selectie_id.trim().length > 0;
}

export class SupabaseProductiekernLeesRepository implements AcquisitieProductiekernRepository {
  constructor(private readonly transport: ProductiekernSupabaseLeesTransport) {}

  async haalDossier(selectieId: string): Promise<AcquisitiedossierContract | null> {
    const rij = await this.transport.haalEen('off_market_acquisitie_dossiers', { selectie_id: selectieId });
    if (!rij) return null;
    const dossier = bewaakDossierLeesTijd(bewaakDossierLeesIntegriteit(mapAcquisitiedossierRij(rij)));
    bewaakGevraagdeLeesIdentiteit('Acquisitiedossier', selectieId, dossier.selectieId);
    return dossier;
  }

  async haalBrief(briefId: string): Promise<BriefContract | null> {
    const rij = await this.transport.haalEen('off_market_brieven', { id: briefId });
    if (!rij || !isFormeleProductiekernBriefRij(rij)) return null;
    const brief = bewaakBriefLeesTijd(bewaakBriefLeesIntegriteit(mapBriefRij(rij)));
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
      rijen.map(mapBriefversieRij)
        .map((versie) => bewaakBriefversieSnapshotLimiet(versie))
        .map((versie) => bewaakBriefversieLeesTijd(versie)),
    );
    bewaakBriefversiesVoorGevraagdeBrief(briefId, versies.map((versie) => versie.briefId));
    return versies;
  }

  async haalPrintbatch(batchId: string): Promise<PrintbatchContract | null> {
    const rij = await this.transport.haalEen('off_market_printbatches', { id: batchId });
    if (!rij) return null;
    const batch = bewaakPrintbatchLeesTijd(bewaakPrintbatchLeesIntegriteit(mapPrintbatchRij(rij)));
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

  async haalBatchdocumenten(batchId: string): Promise<BatchdocumentContract[]> {
    const rijen = await this.transport.haalMeerdere(
      'off_market_batchdocumenten',
      { batch_id: batchId },
      { kolom: 'created_at', oplopend: true },
    );
    const documenten = rijen.map(mapBatchdocumentRij);
    for (const document of documenten) {
      bewaakGevraagdeLeesIdentiteit('Batchdocument', batchId, document.batchId);
    }
    return documenten;
  }

  async haalActievePrintbatchIdVoorBriefversies(briefVersieIds: readonly string[]): Promise<string | null> {
    const ids = [...new Set(briefVersieIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (ids.length === 0) return null;
    if (!this.transport.haalMeerdereOpIds) {
      throw new Error('Bulk-read voor printbatchherstel is niet aangesloten.');
    }

    const rijen = await this.transport.haalMeerdereOpIds('off_market_printbatch_brieven', ids);
    const koppelingen = rijen.map(mapPrintbatchBriefRij);
    const gevraagd = new Set(ids);
    if (koppelingen.some((koppeling) => !gevraagd.has(koppeling.briefVersieId))) {
      throw new Error('Printbatchherstel gaf een koppeling buiten de gevraagde briefscope terug.');
    }

    const gevonden = ids.map((versieId) => {
      const actief = koppelingen.filter((koppeling) =>
        koppeling.briefVersieId === versieId && koppeling.verwijderdOp === null);
      if (actief.length > 1) {
        throw new Error(`Briefversie ${versieId} zit in meerdere actieve printbatches.`);
      }
      return { versieId, batchId: actief[0]?.batchId ?? null };
    });

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
