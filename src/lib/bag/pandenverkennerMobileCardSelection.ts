const MOBILE_PANDENVERKENNER_QUERY = '(max-width: 640px)';
const INTERACTIEF_DOEL = 'a, button, input, select, textarea, label, [role="button"], [role="checkbox"]';

function vindPandenverkennerRij(target: HTMLElement): HTMLElement | null {
  const section = target.closest<HTMLElement>('section.section-card.overflow-hidden');
  if (!section?.querySelector('select[aria-label="Sorteer geladen pagina"]')) return null;

  let node: HTMLElement | null = target;
  while (node && node !== section) {
    const checkbox = Array.from(node.children).find(
      child => child instanceof HTMLElement && child.getAttribute('role') === 'checkbox',
    ) as HTMLElement | undefined;
    if (checkbox && node.textContent?.includes('BAG-pand')) return node;
    node = node.parentElement;
  }
  return null;
}

export function installPandenverkennerMobileCardSelection(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => undefined;

  const onClick = (event: MouseEvent) => {
    if (!window.matchMedia(MOBILE_PANDENVERKENNER_QUERY).matches) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest(INTERACTIEF_DOEL)) return;

    const row = vindPandenverkennerRij(event.target);
    if (!row) return;

    const checkbox = Array.from(row.children).find(
      child => child instanceof HTMLElement && child.getAttribute('role') === 'checkbox',
    ) as HTMLButtonElement | undefined;
    if (!checkbox || checkbox.disabled || checkbox.getAttribute('aria-disabled') === 'true') return;

    checkbox.click();
  };

  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
