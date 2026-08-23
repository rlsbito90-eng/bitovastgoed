import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  leesAantalGeselecteerdUitBulkTekst,
  leesAantalZichtbaar,
  synchroniseerStickySelectieIndicator,
} from './stickySelectieIndicator';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('stickySelectieIndicator', () => {
  it('leest zowel de oude als actuele bulkselectie-aanduiding', () => {
    expect(leesAantalGeselecteerdUitBulkTekst('12 signalen · 18 geadresseerden · 9 brieven')).toBe(12);
    expect(leesAantalGeselecteerdUitBulkTekst('10 geselecteerd · 5 geadresseerden · 5 brieven gereed')).toBe(10);
    expect(leesAantalGeselecteerdUitBulkTekst('0 geselecteerd · 0 geadresseerden · 0 brieven gereed')).toBe(0);
  });

  it('telt de zichtbare dossierrijen', () => {
    document.body.innerHTML = `
      <ul data-testid="acquisitie-selectie-lijst">
        <li></li><li></li><li></li>
      </ul>
    `;
    expect(leesAantalZichtbaar()).toBe(3);
  });

  it('toont onderaan bij de actuele bulktekst en wist via de bestaande bulkactie', () => {
    const wis = vi.fn();
    document.body.innerHTML = `
      <div data-testid="acquisitie-bulk-toolbar">
        <button id="wis">Wis selectie</button>
        <span data-testid="acquisitie-bulk-telling">5 geselecteerd · 7 geadresseerden · 5 brieven gereed</span>
      </div>
      <ul data-testid="acquisitie-selectie-lijst">
        <li></li><li></li><li></li>
      </ul>
    `;
    document.getElementById('wis')?.addEventListener('click', wis);

    synchroniseerStickySelectieIndicator();

    const bar = document.querySelector('[data-testid="acquisitie-sticky-selectieteller"]');
    expect(bar?.textContent).toContain('5 geselecteerd · 3 zichtbaar');

    (bar?.querySelector('[data-role="wissen"]') as HTMLButtonElement).click();
    expect(wis).toHaveBeenCalledTimes(1);

    const telling = document.querySelector('[data-testid="acquisitie-bulk-telling"]');
    if (telling) telling.textContent = '0 geselecteerd · 0 geadresseerden · 0 brieven gereed';
    synchroniseerStickySelectieIndicator();
    expect(document.querySelector('[data-testid="acquisitie-sticky-selectieteller"]')).toBeNull();
  });

  it('verdwijnt zolang een modal geopend is en komt daarna terug', () => {
    document.body.innerHTML = `
      <div data-testid="acquisitie-bulk-toolbar">
        <button>Wis selectie</button>
        <span data-testid="acquisitie-bulk-telling">5 geselecteerd · 7 geadresseerden · 5 brieven gereed</span>
      </div>
      <ul data-testid="acquisitie-selectie-lijst"><li></li><li></li></ul>
    `;

    synchroniseerStickySelectieIndicator();
    expect(document.querySelector('[data-testid="acquisitie-sticky-selectieteller"]')).not.toBeNull();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);
    synchroniseerStickySelectieIndicator();
    expect(document.querySelector('[data-testid="acquisitie-sticky-selectieteller"]')).toBeNull();

    dialog.remove();
    synchroniseerStickySelectieIndicator();
    expect(document.querySelector('[data-testid="acquisitie-sticky-selectieteller"]')?.textContent)
      .toContain('5 geselecteerd · 2 zichtbaar');
  });
});
