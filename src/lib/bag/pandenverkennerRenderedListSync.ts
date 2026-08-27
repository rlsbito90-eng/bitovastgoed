const PANDENVERKENNER_SECTION_SELECTOR = 'section.section-card.overflow-hidden';
const SORTEER_SELECTOR = 'select[aria-label="Sorteer geladen pagina"]';
const RESULTAAT_RIJ_SELECTOR = 'div.flex.items-start.gap-3.p-4';

function vindPandenverkennerSectie(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(PANDENVERKENNER_SECTION_SELECTOR))
    .find(section => section.querySelector(SORTEER_SELECTOR)) ?? null;
}

function isPandRij(element: HTMLElement): boolean {
  const directCheckbox = Array.from(element.children).some(
    child => child instanceof HTMLElement && child.getAttribute('role') === 'checkbox',
  );
  return directCheckbox && Boolean(element.textContent?.includes('BAG-pand'));
}

function bepaalPaginaStart(section: HTMLElement): number {
  const teksten = Array.from(section.querySelectorAll<HTMLElement>('span, div'));
  for (const element of teksten) {
    const match = element.textContent?.match(/Pagina\s+\d+\s+·\s+nummers\s+(\d+)[–-]/i);
    if (match) return Number(match[1]);
  }
  return 1;
}

function synchroniseerNummering(section: HTMLElement): void {
  const start = bepaalPaginaStart(section);
  const rijen = Array.from(section.querySelectorAll<HTMLElement>(RESULTAAT_RIJ_SELECTOR)).filter(isPandRij);

  rijen.forEach((row, index) => {
    const nummerBadge = row.firstElementChild instanceof HTMLElement ? row.firstElementChild : null;
    if (!nummerBadge) return;
    const nummer = String(start + index);
    if (nummerBadge.textContent !== nummer) nummerBadge.textContent = nummer;
    const aria = `Volgnummer ${nummer}`;
    if (nummerBadge.getAttribute('aria-label') !== aria) nummerBadge.setAttribute('aria-label', aria);
  });
}

function synchroniseerGeblokkeerdeRijen(section: HTMLElement): void {
  const rijen = Array.from(section.querySelectorAll<HTMLElement>(RESULTAAT_RIJ_SELECTOR)).filter(isPandRij);
  rijen.forEach(row => {
    const checkbox = Array.from(row.children).find(
      child => child instanceof HTMLElement && child.getAttribute('role') === 'checkbox',
    ) as HTMLButtonElement | undefined;
    const geblokkeerd = Boolean(checkbox?.disabled || checkbox?.getAttribute('aria-disabled') === 'true');
    const waarde = geblokkeerd ? 'true' : 'false';
    if (row.dataset.pandenverkennerGeblokkeerd !== waarde) row.dataset.pandenverkennerGeblokkeerd = waarde;
    if (geblokkeerd && checkbox && !checkbox.getAttribute('aria-label')) {
      checkbox.setAttribute('aria-label', 'Niet selecteerbaar: pand is al bekend of geblokkeerd');
    }
  });
}

function synchroniseerSelectiebar(section: HTMLElement): void {
  const knoppen = Array.from(section.querySelectorAll<HTMLButtonElement>('button'));
  const wisSelectie = knoppen.find(button => button.textContent?.trim() === 'Wis selectie');
  if (!wisSelectie) return;
  const toolbar = wisSelectie.closest<HTMLElement>('div.flex.flex-col.gap-3.border-b.p-4');
  if (!toolbar) return;
  toolbar.dataset.pandenverkennerSelectiebar = 'true';
  toolbar.dataset.active = wisSelectie.disabled ? 'false' : 'true';
}

function synchroniseer(): void {
  const section = vindPandenverkennerSectie();
  if (!section) return;
  synchroniseerNummering(section);
  synchroniseerGeblokkeerdeRijen(section);
  synchroniseerSelectiebar(section);
}

export function installPandenverkennerRenderedListSync(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => undefined;

  let scheduled = false;
  const plan = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      synchroniseer();
    });
  };

  const observer = new MutationObserver(plan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-disabled', 'data-state'],
  });
  plan();

  return () => observer.disconnect();
}
