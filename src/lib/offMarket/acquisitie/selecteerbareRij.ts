const INTERACTIEVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[data-no-row-select="true"]',
].join(',');

/**
 * Bepaalt of een klik op de vrije ruimte van een acquisitierij de bulkselectie
 * mag wisselen. Interactieve bediening en tekstselectie blijven ongemoeid.
 */
export function magRijselectieWisselen(params: {
  target: EventTarget | null;
  huidigeTekstselectie?: string;
}): boolean {
  const { target, huidigeTekstselectie = '' } = params;
  if (huidigeTekstselectie.trim()) return false;
  if (!(target instanceof Element)) return false;
  return target.closest(INTERACTIEVE_SELECTOR) === null;
}

/** Toetsen waarmee een gefocuste rij toegankelijk kan worden geselecteerd. */
export function isRijselectieToets(key: string): boolean {
  return key === ' ' || key === 'Enter';
}
