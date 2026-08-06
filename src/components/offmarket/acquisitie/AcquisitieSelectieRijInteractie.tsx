import { useEffect } from 'react';
import {
  isRijselectieToets,
  magRijselectieWisselen,
} from '@/lib/offMarket/acquisitie/selecteerbareRij';

const TAB_SELECTOR = '[data-testid="acquisitie-selectie-tab"]';
const RIJ_SELECTOR = '[data-testid="acquisitie-selectie-rij"]';
const CHECKBOX_SELECTOR = '[data-testid="acquisitie-rij-bulkcheck"]';
const GEADRESSEERDEN_SELECTOR = '[data-testid="acquisitie-rij-geadresseerden"]';

function isCheckboxGeselecteerd(checkbox: Element | null): boolean {
  if (!checkbox) return false;
  return checkbox.getAttribute('data-state') === 'checked'
    || checkbox.getAttribute('aria-checked') === 'true';
}

function werkRijWeergaveBij(rij: HTMLElement): void {
  const checkbox = rij.querySelector(CHECKBOX_SELECTOR);
  const geselecteerd = isCheckboxGeselecteerd(checkbox);

  rij.setAttribute('aria-selected', String(geselecteerd));
  rij.classList.toggle('bg-accent/5', geselecteerd);
  rij.classList.toggle('ring-1', geselecteerd);
  rij.classList.toggle('ring-inset', geselecteerd);
  rij.classList.toggle('ring-accent/40', geselecteerd);

  const details = rij.querySelector<HTMLDetailsElement>(GEADRESSEERDEN_SELECTOR);
  if (!details) return;

  details.open = true;
  details.setAttribute('data-no-row-select', 'true');
  const summary = details.querySelector('summary');
  if (summary) {
    const aantal = details.querySelectorAll('[data-testid="acquisitie-rij-geadresseerde"]').length;
    summary.textContent = aantal === 1 ? 'Geadresseerde' : `Geadresseerden (${aantal})`;
    summary.classList.remove('cursor-pointer');
    summary.classList.add('cursor-default', 'font-medium', 'text-foreground');
    summary.setAttribute('aria-disabled', 'true');
  }
}

function initialiseerRijen(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(RIJ_SELECTOR).forEach((rij) => {
    rij.tabIndex = 0;
    rij.setAttribute('role', 'option');
    rij.setAttribute('aria-label', 'Acquisitiedossier selecteren voor bulkacties');
    rij.classList.add('cursor-pointer', 'transition-colors', 'focus-visible:outline-none', 'focus-visible:ring-2', 'focus-visible:ring-accent/50');
    werkRijWeergaveBij(rij);
  });
}

function wisselRijselectie(rij: HTMLElement): void {
  const checkbox = rij.querySelector<HTMLElement>(CHECKBOX_SELECTOR);
  checkbox?.click();
  queueMicrotask(() => werkRijWeergaveBij(rij));
}

/**
 * Tijdelijke integratielaag voor de bestaande Acquisitieselectie-lijst.
 * Houdt geadresseerden standaard open en maakt de vrije ruimte van iedere rij
 * selecteerbaar, zonder knoppen, links, dropdowns of tekstselectie te kapen.
 */
export default function AcquisitieSelectieRijInteractie() {
  useEffect(() => {
    const tab = document.querySelector<HTMLElement>(TAB_SELECTOR);
    if (!tab) return;

    initialiseerRijen(tab);

    const observer = new MutationObserver((mutaties) => {
      for (const mutatie of mutaties) {
        if (mutatie.type === 'attributes') {
          const doel = mutatie.target;
          if (doel instanceof Element && doel.matches(CHECKBOX_SELECTOR)) {
            const rij = doel.closest<HTMLElement>(RIJ_SELECTOR);
            if (rij) werkRijWeergaveBij(rij);
          }
          continue;
        }
        mutatie.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(RIJ_SELECTOR)) werkRijWeergaveBij(node as HTMLElement);
          initialiseerRijen(node);
        });
      }
    });

    observer.observe(tab, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-checked', 'data-state'],
    });

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const rij = target.closest<HTMLElement>(RIJ_SELECTOR);
      if (!rij || !tab.contains(rij)) return;
      const selectie = window.getSelection()?.toString() ?? '';
      if (!magRijselectieWisselen({ target, huidigeTekstselectie: selectie })) return;
      wisselRijselectie(rij);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isRijselectieToets(event.key)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const rij = target.closest<HTMLElement>(RIJ_SELECTOR);
      if (!rij || target !== rij || !tab.contains(rij)) return;
      event.preventDefault();
      wisselRijselectie(rij);
    };

    tab.addEventListener('click', onClick);
    tab.addEventListener('keydown', onKeyDown);

    return () => {
      observer.disconnect();
      tab.removeEventListener('click', onClick);
      tab.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
