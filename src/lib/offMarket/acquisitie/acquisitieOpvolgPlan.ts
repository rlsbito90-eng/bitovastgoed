import type { BatchPostregistratieCommando } from './batchPostregistratiePlan';

export interface AcquisitieOpvolgCommando {
  briefId: string;
  briefVersieId: string;
  batchId: string;
  actorId: string;
  operationKey: string;
  verzondenOp: string;
  opvolgenOp: string;
  omschrijving: string;
}

/**
 * Bouwt uitsluitend opvolgcommando's voor aantoonbaar succesvol geposte
 * briefversies. De functie maakt geen taken aan en wijzigt geen dossierstatus.
 */
export function bouwAcquisitieOpvolgPlan(input: {
  geposteCommandos: readonly BatchPostregistratieCommando[];
  opvolgtermijnDagen: number;
  omschrijving?: string;
}): AcquisitieOpvolgCommando[] {
  if (!Number.isInteger(input.opvolgtermijnDagen)
      || input.opvolgtermijnDagen < 1
      || input.opvolgtermijnDagen > 365) {
    throw new Error('Opvolgtermijn moet een geheel aantal dagen tussen 1 en 365 zijn.');
  }
  const omschrijving = input.omschrijving?.trim() || 'Neem contact op over de verzonden acquisitiebrief.';
  if (omschrijving.length > 500) throw new Error('Opvolgomschrijving mag maximaal 500 tekens bevatten.');

  const briefIds = new Set<string>();
  const versieIds = new Set<string>();

  return [...input.geposteCommandos]
    .sort((a, b) => a.briefId.localeCompare(b.briefId) || a.briefVersieId.localeCompare(b.briefVersieId))
    .map((commando) => {
      if (briefIds.has(commando.briefId)) throw new Error(`Brief dubbel in opvolgplan: ${commando.briefId}.`);
      if (versieIds.has(commando.briefVersieId)) {
        throw new Error(`Briefversie dubbel in opvolgplan: ${commando.briefVersieId}.`);
      }
      briefIds.add(commando.briefId);
      versieIds.add(commando.briefVersieId);

      const verzondenMs = Date.parse(commando.verzenddatum);
      if (!Number.isFinite(verzondenMs)) {
        throw new Error(`Verzenddatum van ${commando.briefVersieId} is ongeldig.`);
      }
      const opvolgenOp = new Date(
        verzondenMs + input.opvolgtermijnDagen * 24 * 60 * 60 * 1000,
      ).toISOString();

      return {
        briefId: commando.briefId,
        briefVersieId: commando.briefVersieId,
        batchId: commando.batchId,
        actorId: commando.actorId,
        operationKey: `opvolg:${commando.operationKey}`,
        verzondenOp: commando.verzenddatum,
        opvolgenOp,
        omschrijving,
      };
    });
}
