import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';
import {
  bouwBatchPostregistratieRetryPlan,
  type BatchPostregistratieRetryPlan,
} from './batchPostregistratieRetry';
import {
  bouwAcquisitieOpvolgRetryPlan,
  type AcquisitieOpvolgRetryPlan,
} from './acquisitieOpvolgRetry';

export type AcquisitieNaPostHerstelactie =
  | 'geen'
  | 'postregistratie_opnieuw'
  | 'opvolgtaken_opnieuw'
  | 'dossierbijwerking_opnieuw'
  | 'handmatige_interventie';

export interface AcquisitieNaPostHerstelplan {
  actie: AcquisitieNaPostHerstelactie;
  reden: string;
  postRetry: BatchPostregistratieRetryPlan | null;
  opvolgRetry: AcquisitieOpvolgRetryPlan | null;
  dossierOperationKey: string | null;
}

/**
 * Bepaalt exact één eerstvolgende herstelactie. De volgorde is bewust strikt:
 * eerst postregistratie, daarna opvolgtaken en pas daarna de dossierprojectie.
 * Daardoor wordt nooit een afgeleide stap herhaald terwijl de bronstap nog
 * onvolledig is. Na drie pogingen volgt uitsluitend handmatige interventie.
 */
export function bouwAcquisitieNaPostHerstelplan(input: {
  resultaat: AcquisitieNaPostUseCaseResultaat;
  postPoging: number;
  opvolgPoging: number;
}): AcquisitieNaPostHerstelplan {
  if (!Number.isInteger(input.postPoging) || input.postPoging < 1 || input.postPoging > 3) {
    throw new Error('Postpoging moet tussen 1 en 3 liggen.');
  }
  if (!Number.isInteger(input.opvolgPoging) || input.opvolgPoging < 1 || input.opvolgPoging > 3) {
    throw new Error('Opvolgpoging moet tussen 1 en 3 liggen.');
  }

  const postMislukt = input.resultaat.orchestratie.postregistratie.mislukteCommandos.length > 0;
  if (postMislukt) {
    if (input.postPoging >= 3) {
      return {
        actie: 'handmatige_interventie',
        reden: 'Postregistratie is na drie pogingen niet volledig verwerkt.',
        postRetry: null,
        opvolgRetry: null,
        dossierOperationKey: null,
      };
    }
    return {
      actie: 'postregistratie_opnieuw',
      reden: 'Eén of meer expliciete postregistraties zijn mislukt.',
      postRetry: bouwBatchPostregistratieRetryPlan({
        resultaat: input.resultaat.orchestratie.postregistratie,
        huidigAantalPogingen: input.postPoging,
      }),
      opvolgRetry: null,
      dossierOperationKey: null,
    };
  }

  const opvolgUitkomst = input.resultaat.orchestratie.opvolgUitkomst;
  if (opvolgUitkomst && opvolgUitkomst.misluktAantal > 0) {
    if (input.opvolgPoging >= 3) {
      return {
        actie: 'handmatige_interventie',
        reden: 'Opvolgtaken zijn na drie pogingen niet volledig aangemaakt.',
        postRetry: null,
        opvolgRetry: null,
        dossierOperationKey: null,
      };
    }
    return {
      actie: 'opvolgtaken_opnieuw',
      reden: 'Eén of meer opvolgtaken zijn niet aangemaakt.',
      postRetry: null,
      opvolgRetry: bouwAcquisitieOpvolgRetryPlan({
        oorspronkelijkeCommandos: input.resultaat.orchestratie.opvolgCommandos,
        resultaat: opvolgUitkomst,
        volgendePoging: input.opvolgPoging + 1,
      }),
      dossierOperationKey: null,
    };
  }

  if (!input.resultaat.dossierUitkomst.geslaagd) {
    return {
      actie: 'dossierbijwerking_opnieuw',
      reden: 'De na-postgegevens zijn verwerkt, maar de dossierprojectie is mislukt.',
      postRetry: null,
      opvolgRetry: null,
      dossierOperationKey: input.resultaat.dossierCommando.operationKey,
    };
  }

  return {
    actie: 'geen',
    reden: 'De volledige na-postketen is verwerkt.',
    postRetry: null,
    opvolgRetry: null,
    dossierOperationKey: null,
  };
}
