import type { OperationeleWerkbak } from './operationeleWerkbak';

export interface AcquisitieWerkbakNaPostInput {
  totaalBriefversies: number;
  succesvolGepost: number;
  opvolgenOp: string | null;
  nu: string;
}

export interface AcquisitieWerkbakNaPostResultaat {
  werkbak: OperationeleWerkbak;
  reden: string;
}

/**
 * Projecteert uitsluitend de volgende werkbak. Er wordt niets opgeslagen.
 * Niet alle brieven gepost houdt het dossier in `geprint_posten`.
 */
export function bepaalAcquisitieWerkbakNaPost(
  input: AcquisitieWerkbakNaPostInput,
): AcquisitieWerkbakNaPostResultaat {
  if (!Number.isInteger(input.totaalBriefversies) || input.totaalBriefversies < 1) {
    throw new Error('Totaal aantal briefversies moet minimaal 1 zijn.');
  }
  if (!Number.isInteger(input.succesvolGepost)
      || input.succesvolGepost < 0
      || input.succesvolGepost > input.totaalBriefversies) {
    throw new Error('Aantal succesvol geposte briefversies is ongeldig.');
  }

  if (input.succesvolGepost < input.totaalBriefversies) {
    return {
      werkbak: 'geprint_posten',
      reden: 'Niet alle briefversies zijn aantoonbaar gepost.',
    };
  }
  if (!input.opvolgenOp) {
    throw new Error('Volledig geposte selectie vereist een opvolgdatum.');
  }

  const nuMs = Date.parse(input.nu);
  const opvolgenMs = Date.parse(input.opvolgenOp);
  if (!Number.isFinite(nuMs) || !Number.isFinite(opvolgenMs)) {
    throw new Error('Nu en opvolgdatum moeten geldige tijdstippen zijn.');
  }

  return opvolgenMs <= nuMs
    ? {
        werkbak: 'opvolgen',
        reden: 'De opvolgdatum is bereikt.',
      }
    : {
        werkbak: 'wachten',
        reden: 'Alle briefversies zijn gepost en de opvolgdatum ligt in de toekomst.',
      };
}
