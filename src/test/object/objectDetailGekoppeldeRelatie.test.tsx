// Fase 1C-2 — Gekoppelde-relatie-label op object-detail
//
// Object-detail toont de gekoppelde relatie via RelatieNaamDisplay
// (privacy-safe: alleen naam + bedrijfsnaam, nooit e-mail/telefoon).
// Deze test verifieert het contract van dat label los van de zware
// ObjectDetailPage-render.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RelatieNaamDisplay from '@/components/RelatieNaamDisplay';
import type { Relatie } from '@/data/mock-data';

// useDataStore wordt door RelatieNaamDisplay geraadpleegd voor contactpersonen.
// We geven een lege lijst — de test focust op de relatie zelf.
vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ contactpersonen: [] }),
}));

import { vi } from 'vitest';

const relatie: Relatie = {
  id: 'rel-1',
  bedrijfsnaam: 'Voorbeeld Invest BV',
  contactpersoon: 'Jan de Vries',
  type: 'belegger',
  telefoon: '0612345678',
  email: 'jan@voorbeeld.nl',
  leadStatus: 'lauw',
  ndaGetekend: false,
  laatsteContact: '',
} as Relatie;

describe('Object-detail: gekoppelde-relatie-label (Fase 1C-2)', () => {
  it('toont naam en bedrijfsnaam maar geen e-mail of telefoon', () => {
    const { container } = render(
      <MemoryRouter>
        <RelatieNaamDisplay relatie={relatie} variant="default" />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Jan de Vries');
    expect(text).toContain('Voorbeeld Invest BV');
    expect(text).not.toContain('jan@voorbeeld.nl');
    expect(text).not.toContain('0612345678');
  });

  it('blijft bruikbaar zonder gekoppelde relatie (null)', () => {
    const { container } = render(
      <MemoryRouter>
        <RelatieNaamDisplay relatie={null} variant="default" />
      </MemoryRouter>,
    );
    // Toont "Relatie zonder naam" i.p.v. te crashen
    expect(container.textContent ?? '').toMatch(/zonder naam/i);
  });
});
