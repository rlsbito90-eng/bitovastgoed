// V33 — Mobiele SignalenTable-card toont een herkenbare compacte actie
// (geen icon-only) met aria-label en pictogramonderscheid voor selectie-state.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ relaties: [] }),
}));
let selSet = new Set<string>();
vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useActieveSelectieIds: () => selSet,
  useIsInAcquisitieSelectie: (id: string) => selSet.has(id),
  useVoegToeAanAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerwijderUitAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import SignalenTable from '@/components/offmarket/SignalenTable';

const sig: any = {
  id: 'sig-mob',
  titel: 'Test 1',
  adres: 'Teststraat 1',
  plaats: 'Amsterdam',
  postcode: '1000AA',
  prioriteit: 'laag',
  status: 'nieuw_signaal',
  type_signaal: 'vergunning',
  ai_score: 42,
  ai_status: 'open',
  bron_type: null,
  bron_datum: '2026-01-01',
  created_at: '2026-01-01',
  eigenaar_relatie_id: null,
};

describe('SignalenTable mobiele card-actie', () => {
  it('toont compacte selectieknop met tekst, niet alleen een icoon', () => {
    selSet = new Set();
    render(
      <MemoryRouter>
        <SignalenTable signalen={[sig]} laden={false} />
      </MemoryRouter>,
    );
    const knoppen = screen.getAllByTestId('acquisitie-selectie-toggle');
    // Eerste card = mobiele kaartvariant.
    const knop = knoppen[0];
    expect(knop.getAttribute('data-variant')).toBe('compact');
    expect(knop.textContent).toMatch(/Aan selectie/i);
    expect(knop.getAttribute('aria-label')).toMatch(/acquisitieselectie/i);
  });

  it('toont "Uit selectie" wanneer reeds in selectie en behoudt aria-label', () => {
    selSet = new Set(['sig-mob']);
    render(
      <MemoryRouter>
        <SignalenTable signalen={[sig]} laden={false} />
      </MemoryRouter>,
    );
    const knop = screen.getAllByTestId('acquisitie-selectie-toggle')[0];
    expect(knop.getAttribute('data-in-selectie')).toBe('true');
    expect(knop.textContent).toMatch(/Uit selectie/i);
    expect(knop.textContent).not.toMatch(/^In selectie$/);
    expect(knop.querySelector('svg')).not.toBeNull();
  });

  it('mobiele card heeft maximaal één zichtbare "In selectie"-tekst (badge, geen actieknop)', () => {
    selSet = new Set(['sig-mob']);
    const { container } = render(
      <MemoryRouter>
        <SignalenTable signalen={[sig]} laden={false} />
      </MemoryRouter>,
    );
    const mobileCard = container.querySelector('.sm\\:hidden');
    expect(mobileCard).not.toBeNull();
    const occurrences = (mobileCard!.textContent || '').match(/In selectie/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});
