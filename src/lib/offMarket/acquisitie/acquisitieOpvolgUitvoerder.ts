import type { AcquisitieOpvolgCommando } from './acquisitieOpvolgPlan';

export interface AcquisitieOpvolgTaakPoort {
  maakOpvolgtaak(commando: AcquisitieOpvolgCommando): Promise<void>;
}

export interface AcquisitieOpvolgUitkomst {
  operationKey: string;
  geslaagd: boolean;
  foutcode: string | null;
}

export interface AcquisitieOpvolgUitvoerResultaat {
  uitkomsten: AcquisitieOpvolgUitkomst[];
  geslaagdAantal: number;
  misluktAantal: number;
}

function veiligeFoutcode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '').trim();
    if (/^[A-Z0-9_:-]{1,80}$/i.test(code)) return code;
  }
  return 'OPVOLGTAAK_MISLUKT';
}

/**
 * Voert opvolgcommando's sequentieel uit. Een mislukte taak blokkeert de
 * overige opdrachten niet en vrije foutmeldingen worden nooit doorgegeven.
 */
export async function voerAcquisitieOpvolgPlanUit(input: {
  commandos: readonly AcquisitieOpvolgCommando[];
  poort: AcquisitieOpvolgTaakPoort;
}): Promise<AcquisitieOpvolgUitvoerResultaat> {
  if (input.commandos.length === 0) {
    throw new Error('Opvolguitvoering vereist minimaal één commando.');
  }
  if (input.commandos.length > 1_000) {
    throw new Error('Opvolguitvoering ondersteunt maximaal 1000 commando’s.');
  }

  const operationKeys = new Set<string>();
  const uitkomsten: AcquisitieOpvolgUitkomst[] = [];

  for (const commando of input.commandos) {
    if (!commando.operationKey.trim()) throw new Error('Opvolgcommando mist een operation key.');
    if (operationKeys.has(commando.operationKey)) {
      throw new Error(`Dubbele opvolg-operation key: ${commando.operationKey}.`);
    }
    operationKeys.add(commando.operationKey);

    try {
      await input.poort.maakOpvolgtaak(commando);
      uitkomsten.push({ operationKey: commando.operationKey, geslaagd: true, foutcode: null });
    } catch (error) {
      uitkomsten.push({
        operationKey: commando.operationKey,
        geslaagd: false,
        foutcode: veiligeFoutcode(error),
      });
    }
  }

  const geslaagdAantal = uitkomsten.filter((uitkomst) => uitkomst.geslaagd).length;
  return {
    uitkomsten,
    geslaagdAantal,
    misluktAantal: uitkomsten.length - geslaagdAantal,
  };
}
