import type { AcquisitieNaPostHerstelplan } from './acquisitieNaPostHerstelplan';
import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';
import {
  voerBatchPostregistratieUit,
  type BatchPostregistratieRepository,
} from './batchPostregistratieUitvoerder';
import type { BatchPostregistratieResultaat } from './batchPostregistratieResultaat';
import {
  voerAcquisitieOpvolgPlanUit,
  type AcquisitieOpvolgTaakPoort,
  type AcquisitieOpvolgUitvoerResultaat,
} from './acquisitieOpvolgUitvoerder';
import {
  voerAcquisitieNaPostDossierPlanUit,
  type AcquisitieNaPostDossierPoort,
  type AcquisitieNaPostDossierUitkomst,
} from './acquisitieNaPostDossierUitvoerder';

export interface AcquisitieNaPostHerstelPoorten {
  postRepository: BatchPostregistratieRepository;
  opvolgTaakpoort: AcquisitieOpvolgTaakPoort;
  dossierPoort: AcquisitieNaPostDossierPoort;
}

export interface AcquisitieNaPostHerstelUitkomst {
  actie: AcquisitieNaPostHerstelplan['actie'];
  uitgevoerd: boolean;
  postregistratie: BatchPostregistratieResultaat | null;
  opvolging: AcquisitieOpvolgUitvoerResultaat | null;
  dossier: AcquisitieNaPostDossierUitkomst | null;
}

/**
 * Voert exact de door het herstelplan aangewezen stap uit. De uitvoerder slaat
 * nooit een eerdere mislukte stap over en voert bij handmatige interventie of
 * een volledig verwerkte keten geen write uit.
 */
export async function voerAcquisitieNaPostHerstelUit(input: {
  plan: AcquisitieNaPostHerstelplan;
  oorspronkelijkResultaat: AcquisitieNaPostUseCaseResultaat;
  poorten: AcquisitieNaPostHerstelPoorten;
}): Promise<AcquisitieNaPostHerstelUitkomst> {
  switch (input.plan.actie) {
    case 'geen':
    case 'handmatige_interventie':
      return {
        actie: input.plan.actie,
        uitgevoerd: false,
        postregistratie: null,
        opvolging: null,
        dossier: null,
      };

    case 'postregistratie_opnieuw': {
      if (!input.plan.postRetry || input.plan.opvolgRetry || input.plan.dossierOperationKey) {
        throw new Error('Postherstelplan bevat een inconsistente payload.');
      }
      const postregistratie = await voerBatchPostregistratieUit({
        repository: input.poorten.postRepository,
        plan: {
          batchId: input.plan.postRetry.batchId,
          commandos: input.plan.postRetry.commandos,
          overgeslagenBriefVersieIds: [],
          gedeeltelijkGepost: false,
          volledigGepost: true,
        },
      });
      return {
        actie: input.plan.actie,
        uitgevoerd: true,
        postregistratie,
        opvolging: null,
        dossier: null,
      };
    }

    case 'opvolgtaken_opnieuw': {
      if (!input.plan.opvolgRetry || input.plan.postRetry || input.plan.dossierOperationKey) {
        throw new Error('Opvolgherstelplan bevat een inconsistente payload.');
      }
      const opvolging = await voerAcquisitieOpvolgPlanUit({
        commandos: input.plan.opvolgRetry.commandos,
        poort: input.poorten.opvolgTaakpoort,
      });
      return {
        actie: input.plan.actie,
        uitgevoerd: true,
        postregistratie: null,
        opvolging,
        dossier: null,
      };
    }

    case 'dossierbijwerking_opnieuw': {
      if (!input.plan.dossierOperationKey || input.plan.postRetry || input.plan.opvolgRetry) {
        throw new Error('Dossierherstelplan bevat een inconsistente payload.');
      }
      if (input.plan.dossierOperationKey !== input.oorspronkelijkResultaat.dossierCommando.operationKey) {
        throw new Error('Dossierherstel verwijst niet naar de oorspronkelijke operation key.');
      }
      const dossier = await voerAcquisitieNaPostDossierPlanUit({
        commando: input.oorspronkelijkResultaat.dossierCommando,
        poort: input.poorten.dossierPoort,
      });
      return {
        actie: input.plan.actie,
        uitgevoerd: true,
        postregistratie: null,
        opvolging: null,
        dossier,
      };
    }
  }
}
