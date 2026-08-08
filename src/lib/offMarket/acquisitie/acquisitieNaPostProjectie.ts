import type { NaPostOrchestratieResultaat } from './acquisitieNaPostOrchestratie';
import {
  bepaalAcquisitieWerkbakNaPost,
  type AcquisitieWerkbakNaPostResultaat,
} from './acquisitieWerkbakNaPost';

export interface AcquisitieNaPostProjectie {
  batchId: string;
  totaalBriefversies: number;
  succesvolGepost: number;
  postregistratieMislukt: number;
  opvolgtakenGeslaagd: number;
  opvolgtakenMislukt: number;
  retryPostNodig: boolean;
  retryOpvolgingNodig: boolean;
  werkbak: AcquisitieWerkbakNaPostResultaat['werkbak'];
  werkbakReden: string;
  opvolgenOp: string | null;
}

/**
 * Maakt een UI-geschikte, read-only projectie van de na-postketen. De projectie
 * schrijft niets weg en verbergt geen gedeeltelijke of mislukte verwerking.
 *
 * Opvolgtaken mogen al per aantoonbaar geposte brief bestaan, maar de
 * dossierbrede volgende actie wordt pas een opvolgdatum nadat álle briefversies
 * aantoonbaar zijn gepost. Bij gedeeltelijke posting blijft het dossier daarom
 * in `geprint_posten` met `opvolgenOp: null`.
 */
export function projecteerAcquisitieNaPostResultaat(input: {
  resultaat: NaPostOrchestratieResultaat;
  totaalBriefversies: number;
  nu: string;
}): AcquisitieNaPostProjectie {
  const { resultaat } = input;
  const succesvolGepost = resultaat.postregistratie.geslaagdeCommandos.length;
  const postregistratieMislukt = resultaat.postregistratie.mislukteCommandos.length;
  const opvolgtakenGeslaagd = resultaat.opvolgUitkomst?.geslaagdAantal ?? 0;
  const opvolgtakenMislukt = resultaat.opvolgUitkomst?.misluktAantal ?? 0;

  if (succesvolGepost > input.totaalBriefversies) {
    throw new Error('Aantal succesvol geposte briefversies overschrijdt het totaal.');
  }
  if (resultaat.opvolgCommandos.length !== succesvolGepost) {
    throw new Error('Iedere succesvol geposte briefversie moet exact één opvolgcommando hebben.');
  }
  if (opvolgtakenGeslaagd + opvolgtakenMislukt !== resultaat.opvolgCommandos.length) {
    throw new Error('Opvolguitkomsten sluiten niet aan op de geplande opvolgcommando’s.');
  }

  const vroegsteOpvolgenOp = resultaat.opvolgCommandos.length > 0
    ? resultaat.opvolgCommandos.reduce((vroegste, commando) =>
      commando.opvolgenOp < vroegste ? commando.opvolgenOp : vroegste,
    resultaat.opvolgCommandos[0].opvolgenOp)
    : null;
  const volledigGepost = succesvolGepost === input.totaalBriefversies;
  const opvolgenOp = volledigGepost ? vroegsteOpvolgenOp : null;

  const werkbak = bepaalAcquisitieWerkbakNaPost({
    totaalBriefversies: input.totaalBriefversies,
    succesvolGepost,
    opvolgenOp,
    nu: input.nu,
  });

  return {
    batchId: resultaat.postregistratie.batchId,
    totaalBriefversies: input.totaalBriefversies,
    succesvolGepost,
    postregistratieMislukt,
    opvolgtakenGeslaagd,
    opvolgtakenMislukt,
    retryPostNodig: postregistratieMislukt > 0,
    retryOpvolgingNodig: opvolgtakenMislukt > 0,
    werkbak: werkbak.werkbak,
    werkbakReden: werkbak.reden,
    opvolgenOp,
  };
}
