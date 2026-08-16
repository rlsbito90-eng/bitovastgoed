const BULK_TELLING_SELECTOR = '[data-testid="acquisitie-bulk-telling"]';
const LIJST_SELECTOR = '[data-testid="acquisitie-selectie-lijst"]';
const BAR_ID = 'acquisitie-sticky-selectieteller';

let observer: MutationObserver | null = null;
let gebruikers = 0;

export function leesAantalGeselecteerdUitBulkTekst(tekst: string | null | undefined): number {
  const match = String(tekst ?? '').trim().match(/^(\d+)\s+signalen\b/i);
  return match ? Number(match[1]) : 0;
}

export function leesAantalZichtbaar(root: ParentNode = document): number {
  const lijst = root.querySelector(LIJST_SELECTOR);
  if (!lijst) return 0;
  return lijst.querySelectorAll(':scope > li').length;
}

function vindWisSelectieKnop(): HTMLButtonElement | null {
  const toolbar = document.querySelector('[data-testid="acquisitie-bulk-toolbar"]');
  if (!toolbar) return null;
  return Array.from(toolbar.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'Wis selectie',
  ) as HTMLButtonElement | undefined ?? null;
}

function verwijderBar() {
  document.getElementById(BAR_ID)?.remove();
}

function maakBar(): HTMLDivElement {
  const bestaand = document.getElementById(BAR_ID);
  if (bestaand instanceof HTMLDivElement) return bestaand;

  const bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.dataset.testid = 'acquisitie-sticky-selectieteller';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.className = [
    'fixed', 'bottom-4', 'left-1/2', 'z-[70]', '-translate-x-1/2',
    'flex', 'max-w-[calc(100vw-2rem)]', 'items-center', 'gap-3',
    'rounded-xl', 'border', 'border-border', 'bg-background/95', 'px-4', 'py-2.5',
    'shadow-lg', 'backdrop-blur',
  ].join(' ');

  const tekst = document.createElement('span');
  tekst.dataset.role = 'telling';
  tekst.className = 'whitespace-nowrap text-sm font-medium text-foreground tabular-nums';
  bar.appendChild(tekst);

  const wissen = document.createElement('button');
  wissen.type = 'button';
  wissen.dataset.role = 'wissen';
  wissen.className = [
    'rounded-md', 'px-2.5', 'py-1.5', 'text-xs', 'font-medium', 'text-muted-foreground',
    'transition-colors', 'hover:bg-muted', 'hover:text-foreground',
  ].join(' ');
  wissen.textContent = 'Selectie wissen';
  wissen.addEventListener('click', () => vindWisSelectieKnop()?.click());
  bar.appendChild(wissen);

  document.body.appendChild(bar);
  return bar;
}

export function synchroniseerStickySelectieIndicator(root: ParentNode = document) {
  if (typeof document === 'undefined') return;

  const telling = root.querySelector(BULK_TELLING_SELECTOR)?.textContent;
  const geselecteerd = leesAantalGeselecteerdUitBulkTekst(telling);
  if (geselecteerd <= 0) {
    verwijderBar();
    return;
  }

  const zichtbaar = leesAantalZichtbaar(root);
  const bar = maakBar();
  const tekst = bar.querySelector<HTMLElement>('[data-role="telling"]');
  if (tekst) tekst.textContent = `${geselecteerd} geselecteerd · ${zichtbaar} zichtbaar`;
}

export function activeerStickySelectieIndicator(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};

  gebruikers += 1;
  if (!observer) {
    observer = new MutationObserver(() => synchroniseerStickySelectieIndicator());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-selected', 'data-state'],
    });
    synchroniseerStickySelectieIndicator();
  }

  return () => {
    gebruikers = Math.max(0, gebruikers - 1);
    if (gebruikers === 0) {
      observer?.disconnect();
      observer = null;
      verwijderBar();
    }
  };
}
