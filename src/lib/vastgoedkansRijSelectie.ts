const INTERACTIEVE_RIJ_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="link"]',
  '[data-no-row-select="true"]',
].join(',');

export function isInteractiefVastgoedkansRijDoel(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIEVE_RIJ_SELECTOR));
}
