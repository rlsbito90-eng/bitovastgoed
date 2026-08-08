import type { ProductiekernSchemaProefBewijs } from './productiekernSchemaProefBewijs';

export interface ProductiekernSchemaProefBewijsGeldigheidInput {
  bewijs: ProductiekernSchemaProefBewijs;
  verwachtDoelomgeving: string;
  verwachtSchemaNaam: string;
  beoordeeldOp: string;
  maximaleLeeftijdUren: number;
}

export interface ProductiekernSchemaProefBewijsGeldigheid {
  geldig: boolean;
  leeftijdUren: number;
  blokkades: string[];
}

/**
 * Beoordeelt of een bestaand schema-only proefbewijs nog bruikbaar is als
 * technisch bewijs voor een volgende, afzonderlijk besloten stap.
 *
 * Geldigheid activeert niets. Het bewijs blijft uitsluitend rollbackproefbewijs
 * en verleent nooit lees-, write- of productieactivatie.
 */
export function beoordeelProductiekernSchemaProefBewijsGeldigheid(
  input: ProductiekernSchemaProefBewijsGeldigheidInput,
): ProductiekernSchemaProefBewijsGeldigheid {
  const blokkades: string[] = [];
  const vastgesteldOpMs = Date.parse(input.bewijs.vastgesteldOp);
  const beoordeeldOpMs = Date.parse(input.beoordeeldOp);

  if (Number.isNaN(vastgesteldOpMs)) {
    blokkades.push('Het vaststellingstijdstip van het proefbewijs is ongeldig.');
  }
  if (Number.isNaN(beoordeeldOpMs)) {
    blokkades.push('Het beoordelingstijdstip is ongeldig.');
  }
  if (!Number.isFinite(input.maximaleLeeftijdUren) || input.maximaleLeeftijdUren <= 0) {
    blokkades.push('De maximale bewijsleeftijd moet groter dan nul zijn.');
  }

  const leeftijdUren = blokkades.length === 0
    ? (beoordeeldOpMs - vastgesteldOpMs) / 3_600_000
    : Number.POSITIVE_INFINITY;

  if (input.bewijs.doelomgeving !== input.verwachtDoelomgeving.trim()) {
    blokkades.push('De doelomgeving van het proefbewijs wijkt af.');
  }
  if (input.bewijs.schemaNaam !== input.verwachtSchemaNaam.trim()) {
    blokkades.push('Het proefschema van het bewijs wijkt af.');
  }
  if (leeftijdUren < 0) {
    blokkades.push('Het proefbewijs ligt in de toekomst ten opzichte van de beoordeling.');
  }
  if (leeftijdUren > input.maximaleLeeftijdUren) {
    blokkades.push(
      `Het proefbewijs is ${leeftijdUren} uur oud; maximaal `
      + `${input.maximaleLeeftijdUren} uur toegestaan.`,
    );
  }
  if (input.bewijs.verleentProductieactivatie || input.bewijs.verleentWriteActivatie) {
    blokkades.push('Het proefbewijs bevat een verboden activatieclaim.');
  }

  return {
    geldig: blokkades.length === 0,
    leeftijdUren,
    blokkades,
  };
}
