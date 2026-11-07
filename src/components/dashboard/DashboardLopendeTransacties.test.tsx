// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LopendeTransactie } from '@/lib/dashboard/lopendeTransacties';
import DashboardLopendeTransacties from './DashboardLopendeTransacties';

const t = (id: string, over: Partial<LopendeTransactie> = {}): LopendeTransactie => ({
  objectId: id, objectTitel: `Object ${id}`, objectOnHold: false, kandidaatId: `k${id}`, relatieId: 'r', koper: 'Koper BV',
  fase: 'onderhandeling', faseLabel: 'Onderhandeling', gewensteLevering: null, mijlpaal: null, volgendeActie: null,
  laatsteActiviteit: '2026-11-05', stilDagen: null, laatsteBod: null, ...over,
});
const renderL = (items: LopendeTransactie[], totaal = items.length) =>
  render(<MemoryRouter><DashboardLopendeTransacties overzicht={{ items, totaal }} /></MemoryRouter>);

describe('DashboardLopendeTransacties', () => {
  it('toont object (link naar dossier), fase, koper en volgende actie', () => {
    renderL([t('A', { volgendeActie: { tekst: 'Bellen', datum: null } })]);
    expect(screen.getByText('Lopende transacties')).toBeTruthy();
    expect(screen.getByText('Object A').closest('a')?.getAttribute('href')).toBe('/objecten/A');
    expect(screen.getByTestId('transactie-fase').textContent).toBe('Onderhandeling');
    expect(screen.getByText('Koper BV')).toBeTruthy();
    expect(screen.getByText('Bellen')).toBeTruthy();
    expect(screen.getByText('1 traject · verst gevorderd eerst')).toBeTruthy();
  });

  it('stilgevallen traject krijgt een label', () => {
    renderL([t('A', { stilDagen: 18 })]);
    expect(screen.getByTestId('transactie-stil').textContent).toBe('Stil sinds 18 dagen');
  });

  it('laatste bod alleen als context, zonder bedrag te verzinnen', () => {
    const { unmount } = renderL([t('A', { laatsteBod: { bedrag: 1200000, datum: '2026-11-03', status: 'tegenvoorstel_gedaan' } })]);
    expect(screen.getByTestId('transactie-bod').textContent).toMatch(/^Laatste bod €.?1\.200\.000 · 3 nov · tegenvoorstel gedaan$/);
    unmount();
    renderL([t('B', { laatsteBod: { bedrag: null, datum: '2026-11-03', status: 'ontvangen' } })]);
    expect(screen.getByTestId('transactie-bod').textContent).toContain('zonder bedrag');
  });

  it('onbekende gegevens worden niet ingevuld', () => {
    renderL([t('A', { koper: null })]);
    expect(screen.getByText('Koper niet gekoppeld')).toBeTruthy();
    expect(screen.getByText('niet vastgelegd')).toBeTruthy();
    expect(screen.queryByTestId('transactie-bod')).toBeNull();
    expect(screen.queryByTestId('transactie-stil')).toBeNull();
  });

  it('verlopen volgende actie is gemarkeerd', () => {
    renderL([t('A', { volgendeActie: { tekst: 'Terugbellen', datum: '2026-11-01' }, mijlpaal: { soort: 'actie', datum: '2026-11-01', verlopen: true } })]);
    expect(screen.getByText(/1 nov \(verlopen\)/)).toBeTruthy();
  });

  it('meer dan drie: "3 van n"; leeg: geen resultaat gesuggereerd', () => {
    const { unmount } = renderL([t('A'), t('B'), t('C')], 5);
    expect(screen.getAllByTestId('lopende-transactie')).toHaveLength(3);
    expect(screen.getByText('3 van 5 · verst gevorderd eerst')).toBeTruthy();
    unmount();
    renderL([]);
    expect(screen.getByText('Geen lopende transacties vanaf Bieding / prijsvoorstel.')).toBeTruthy();
    expect(screen.queryByTestId('lopende-transactie')).toBeNull();
  });

  it('geen kanspercentages in beeld', () => {
    renderL([t('A'), t('B')]);
    expect(screen.getByTestId('dashboard-lopende-transacties').textContent).not.toMatch(/%|kans/i);
  });
});
