import type { BiedingStatus } from './types';

/** Biedingsstatussen die als "lopend" gelden in het objectdossier (inclusief concept). */
export const ACTIEVE_BIEDING_STATUSSEN: BiedingStatus[] = [
  'concept', 'ontvangen', 'in_behandeling', 'tegenvoorstel_gedaan', 'aangepast_bod_gevraagd',
];

/**
 * Open biedingen voor het dashboard: de actieve statussen zonder concept,
 * omdat een concept nog niet is uitgebracht.
 */
export const OPEN_BIEDING_STATUSSEN: BiedingStatus[] =
  ACTIEVE_BIEDING_STATUSSEN.filter(status => status !== 'concept');
