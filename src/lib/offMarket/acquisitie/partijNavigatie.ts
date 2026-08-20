export const ACQUISITIE_OPEN_PARTIJ_EVENT = 'off-market-acquisitie:open-partij';

export function openAcquisitiePartij(partijKey: string): void {
  if (typeof window === 'undefined' || !partijKey) return;
  window.dispatchEvent(new CustomEvent<string>(ACQUISITIE_OPEN_PARTIJ_EVENT, { detail: partijKey }));
}
