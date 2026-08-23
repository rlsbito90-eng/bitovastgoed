const BULK_TELLING_SELECTOR = '[data-testid="acquisitie-bulk-telling"]';
const LIJST_SELECTOR = '[data-testid="acquisitie-selectie-lijst"]';
const SELECTIE_TAB_SELECTOR = '[data-testid="acquisitie-selectie-tab"]';
const BAR_ID = 'acquisitie-sticky-selectieteller';
const SAFE_SPACE_ID = 'acquisitie-sticky-selectieteller-ruimte';
const OPEN_DIALOG_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

let observer: MutationObserver | null = null;
let gebruikers = 0;
let synchronisatieGepland = false;

export function leesAantalGeselecteerdUitBulkTekst(tekst: string | null | undefined): number {
  const match = String(tekst ?? '').trim().match(/^(\d+)\s+(?:signalen|geselecteerd)\b/i);
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

function verwijderVeiligeRuimte() {
  document.getElementById(SAFE_SPACE_ID)?.remove();
}

function heeftOpenModal(root: ParentNode = document): boolean {
  return root.querySelector(OPEN_DIALOG_SELECTOR) != null;
}

function maakVeiligeRuimte(root: ParentNode = document) {
  const bestaande = document.getElementById(SAFE_SPACE_ID);
  if (bestaande) return;

  const selectieTab = root.querySelector(SELECTIE_TAB_SELECTOR);
  const container = selectieTab?.parentElement;
  if (!container) return;

  const ruimte = document.createElement('div');
  ruimte.id = SAFE_SPACE_ID;
  ruimte.setAttribute('aria-hidden', 'true');
  ruimte.className = 'h-24 sm:h-20';
  container.appendChild(ruimte);
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
    'rounded-2xl', 'border', 'border-white/30', 'dark:border-white/10',
    'bg-background/60', 'px-4', 'py-2.5',
    'shadow-[0_12px_40px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.38)]',
    'backdrop-blur-xl', 'backdrop-saturate-150',
  ].join(' ');

  const tekst = document.createElement('span');
  tekst.dataset.role = 'telling';
  tekst.className = 'whitespace-nowrap text-sm font-medium text-foreground tabular-nums drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]';
  bar.appendChild(tekst);

  const wissen = document.createElement('button');
  wissen.type = 'button';
  wissen.dataset.role = 'wissen';
  wissen.className = [
    'rounded-lg', 'border', 'border-white/20', 'bg-background/25',
    'px-2.5', 'py-1.5', 'text-xs', 'font-medium', 'text-muted-foreground',
    'transition-colors', 'hover:bg-background/45', 'hover:text-foreground',
  ].join(' ');
  wissen.textContent = 'Selectie wissen';
  wissen.addEventListener('click', () => vindWisSelectieKnop()?.click());
  bar.appendChild(wissen);

  document.body.appendChild(bar);
  return bar;
}

export function synchroniseerStickySelectieIndicator(root: ParentNode = document) {
  if (typeof document === 'undefined') return;

  if (heeftOpenModal(root)) {
    verwijderBar();
    verwijderVeiligeRuimte();
    return;
  }

  const telling = root.querySelector(BULK_TELLING_SELECTOR)?.textContent;
  const geselecteerd = leesAantalGeselecteerdUitBulkTekst(telling);
  if (geselecteerd <= 0) {
    verwijderBar();
    verwijderVeiligeRuimte();
    return;
  }

  const zichtbaar = leesAantalZichtbaar(root);
  const bar = maakBar();
  maakVeiligeRuimte(root);
  const tekst = bar.querySelector<HTMLElement>('[data-role="telling"]');
  const nieuweTekst = `${geselecteerd} geselecteerd · ${zichtbaar} zichtbaar`;
  if (tekst && tekst.textContent !== nieuweTekst) tekst.textContent = nieuweTekst;
}

function planSynchronisatie() {
  if (synchronisatieGepland) return;
  synchronisatieGepland = true;
  queueMicrotask(() => {
    synchronisatieGepland = false;
    synchroniseerStickySelectieIndicator();
  });
}

export function activeerStickySelectieIndicator(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};

  gebruikers += 1;
  if (!observer) {
    observer = new MutationObserver((mutaties) => {
      const alleenEigenBar = mutaties.every((mutatie) => {
        const target = mutatie.target instanceof Element
          ? mutatie.target
          : mutatie.target.parentElement;
        return target?.closest(`#${BAR_ID}`) != null || target?.closest(`#${SAFE_SPACE_ID}`) != null;
      });
      if (!alleenEigenBar) planSynchronisatie();
    });
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
      synchronisatieGepland = false;
      verwijderBar();
      verwijderVeiligeRuimte();
    }
  };
}
