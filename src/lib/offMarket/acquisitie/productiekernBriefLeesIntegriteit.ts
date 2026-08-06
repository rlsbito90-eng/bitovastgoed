import type { BriefContract } from './productiekernContract';

export class ProductiekernBriefLeesIntegriteitError extends Error {
  readonly code = 'ACQUISITIE_PRODUCTIEKERN_BRIEF_LEESINTEGRITEIT';

  constructor(reden: string) {
    super(`Brief-readintegriteit geschonden: ${reden}`);
    this.name = 'ProductiekernBriefLeesIntegriteitError';
  }
}

export function bewaakBriefLeesIntegriteit(brief: BriefContract): BriefContract {
  if (brief.actieveVersie !== null && brief.actieveVersie < 1) {
    throw new ProductiekernBriefLeesIntegriteitError(
      'actieve versie moet minimaal 1 zijn',
    );
  }

  if (brief.status === 'concept') {
    if (brief.briefnummer !== null) {
      throw new ProductiekernBriefLeesIntegriteitError(
        'conceptbrief heeft al een briefnummer',
      );
    }
    if (brief.definitiefOp !== null || brief.vergrendeldOp !== null) {
      throw new ProductiekernBriefLeesIntegriteitError(
        'conceptbrief is ten onrechte definitief of vergrendeld',
      );
    }
  }

  if (brief.status === 'definitief') {
    if (!brief.briefnummer) {
      throw new ProductiekernBriefLeesIntegriteitError(
        'definitieve brief mist een briefnummer',
      );
    }
    if (brief.definitiefOp === null || brief.vergrendeldOp === null) {
      throw new ProductiekernBriefLeesIntegriteitError(
        'definitieve brief mist definitief- of vergrendeldatum',
      );
    }
    if (brief.actieveVersie === null) {
      throw new ProductiekernBriefLeesIntegriteitError(
        'definitieve brief mist een actieve versie',
      );
    }
  }

  if (brief.status === 'geannuleerd' && !brief.annuleringsreden?.trim()) {
    throw new ProductiekernBriefLeesIntegriteitError(
      'geannuleerde brief mist een annuleringsreden',
    );
  }

  return brief;
}
