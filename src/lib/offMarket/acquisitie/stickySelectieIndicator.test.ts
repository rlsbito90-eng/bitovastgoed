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
  it('leest het canonieke bulkselectie-aantal uit de bestaande toolbar', () => {
    expect(leesAantalGeselecteerdUitBulkTekst('12 signalen · 18 geadresseerden · 9 brieven')).toBe(12);
    expect(leesAantalGeselecteerdUitBulkTekst('0 signalen · 0 geadresseerden · 0 brieven')).toBe(0);
  });

  it('telt de zichtbare dossierrijen', () => {
    document.body.innerHTML = `
      <ul data-testid="acquisitie-selectie-lijst">
        <li></li><li></li><li></li>
      </ul>
    `;
    expect(leesAantalZichtbaar()).toBe(3);
  });

  it('toont onderaan alleen bij een actieve selectie en wist via de bestaande bulkactie', () => {
    const wis = vi.fn();
    document.body.innerHTML = `
      <div data-testid="acquisitie-bulk-toolbar">
        <button id="wis">Wis selectie</button>
        <span data-testid="acquisitie-bulk-telling">5 signalen · 7 geadresseerden · 5 brieven</span>
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
    if (telling) telling.textContent = '0 signalen · 0 geadresseerden · 0 brieven';
    synchroniseerStickySelectieIndicator();
    expect(document.querySelector('[data-testid="acquisitie-sticky-selectieteller"]')).toBeNull();
  });
});
