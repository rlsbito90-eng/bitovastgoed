import type { ProductiekernConcurrencyProefBewijs } from './productiekernConcurrencyProefBewijs';

export interface ProductiekernConcurrencyProefBewijsGeldigheidInput {
  bewijs: ProductiekernConcurrencyProefBewijs;
  verwachtDoelomgeving: string;
  verwachtSchemaNaam: string;
  beoordeeldOp: string;
  maximaleLeeftijdUren: number;
}

export interface ProductiekernConcurrencyProefBewijsGeldigheid {
  geldig: boolean;
  leeftijdUren: number | null;
  blokkades: string[];
}

export function beoordeelProductiekernConcurrencyProefBewijsGeldigheid(
  input: ProductiekernConcurrencyProefBewijsGeldigheidInput,
): ProductiekernConcurrencyProefBewijsGeldigheid {
  const blokkades: string[] = [];
  const vastgesteld = Date.parse(input.bewijs.vastgesteldOp);
  const beoordeeld = Date.parse(input.beoordeeldOp);

  if (!Number.isFinite(input.maximaleLeeftijdUren) || input.maximaleLeeftijdUren <= 0) {
    blokkades.push('De maximale bewijsleeftijd moet groter dan nul zijn.');
  }
  if (Number.isNaN(vastgesteld)) blokkades.push('Het vaststellingstijdstip van het bewijs is ongeldig.');
  if (Number.isNaN(beoordeeld)) blokkades.push('Het beoordelingstijdstip is ongeldig.');
  if (input.bewijs.doelomgeving !== input.verwachtDoelomgeving) {
    blokkades.push('De doelomgeving van het concurrencybewijs wijkt af.');
  }
  if (input.bewijs.schemaNaam !== input.verwachtSchemaNaam) {
    blokkades.push('Het proefschema van het concurrencybewijs wijkt af.');
  }
  if (input.bewijs.verleentProductieMigratie || input.bewijs.verleentProductieActivatie) {
    blokkades.push('Het concurrencybewijs bevat een verboden productieclaim.');
  }

  let leeftijdUren: number | null = null;
  if (!Number.isNaN(vastgesteld) && !Number.isNaN(beoordeeld)) {
    leeftijdUren = (beoordeeld - vastgesteld) / 3_600_000;
    if (leeftijdUren < 0) blokkades.push('Het concurrencybewijs ligt in de toekomst.');
    if (leeftijdUren > input.maximaleLeeftijdUren) {
      blokkades.push('Het concurrencybewijs is ouder dan de toegestane maximale leeftijd.');
    }
  }

  return { geldig: blokkades.length === 0, leeftijdUren, blokkades };
}
