import type { AcquisitieOpvolgCommando } from './acquisitieOpvolgPlan';
import type { AcquisitieOpvolgUitvoerResultaat } from './acquisitieOpvolgUitvoerder';

export interface AcquisitieOpvolgRetryPlan {
  poging: number;
  commandos: AcquisitieOpvolgCommando[];
  volledigAfgerond: boolean;
}

/**
 * Selecteert uitsluitend mislukte opvolgcommando's voor een begrensde retry.
 * Operation keys blijven gelijk zodat de taakpoort idempotentie kan afdwingen.
 */
export function bouwAcquisitieOpvolgRetryPlan(input: {
  oorspronkelijkeCommandos: readonly AcquisitieOpvolgCommando[];
  resultaat: AcquisitieOpvolgUitvoerResultaat;
  volgendePoging: number;
  maximaalAantalPogingen?: number;
}): AcquisitieOpvolgRetryPlan {
  const maximum = input.maximaalAantalPogingen ?? 3;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 3) {
    throw new Error('Maximaal aantal opvolgpogingen moet tussen 1 en 3 liggen.');
  }
  if (!Number.isInteger(input.volgendePoging) || input.volgendePoging < 2) {
    throw new Error('Een opvolgretry begint bij poging 2.');
  }
  if (input.volgendePoging > maximum) {
    throw new Error('Maximaal aantal opvolgpogingen is bereikt.');
  }

  const commandos = new Map(
    input.oorspronkelijkeCommandos.map((commando) => [commando.operationKey, commando]),
  );
  if (commandos.size !== input.oorspronkelijkeCommandos.length) {
    throw new Error('Oorspronkelijke opvolgcommando’s bevatten dubbele operation keys.');
  }

  const uitkomsten = new Map<string, boolean>();
  for (const uitkomst of input.resultaat.uitkomsten) {
    if (!commandos.has(uitkomst.operationKey)) {
      throw new Error(`Onbekende opvolguitkomst: ${uitkomst.operationKey}.`);
    }
    if (uitkomsten.has(uitkomst.operationKey)) {
      throw new Error(`Dubbele opvolguitkomst: ${uitkomst.operationKey}.`);
    }
    uitkomsten.set(uitkomst.operationKey, uitkomst.geslaagd);
  }
  if (uitkomsten.size !== commandos.size) {
    throw new Error('Niet alle opvolgcommando’s hebben een uitkomst.');
  }

  const retryCommandos = input.oorspronkelijkeCommandos.filter(
    (commando) => uitkomsten.get(commando.operationKey) === false,
  );
  if (retryCommandos.length === 0) {
    throw new Error('Er zijn geen mislukte opvolgcommando’s om opnieuw uit te voeren.');
  }

  return {
    poging: input.volgendePoging,
    commandos: [...retryCommandos],
    volledigAfgerond: false,
  };
}
