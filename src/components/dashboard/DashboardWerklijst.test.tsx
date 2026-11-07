// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Taak } from '@/data/mock-data';
import DashboardWerklijst, { werklijstZichtbaarheid } from './DashboardWerklijst';
import DashboardKengetallen from './DashboardKengetallen';

vi.mock('@/components/tasks/QuickTaskCapture', () => ({
  default: ({ defaultTarget }: { defaultTarget: string }) => <div data-testid="quick-capture">{defaultTarget}</div>,
}));

const taken = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, titel: `${prefix} ${i}` }) as unknown as Taak);
const renderTask = (t: Taak) => <div key={t.id} data-testid="rij">{t.titel}</div>;

const renderLijst = (groups: { achterstallig: Taak[]; doorgeschoven: Taak[]; vandaag: Taak[] }) =>
  render(<MemoryRouter><DashboardWerklijst groups={groups} renderTask={renderTask} /></MemoryRouter>);

describe('DashboardWerklijst', () => {
  it('heet Mijn werkzaamheden', () => {
    renderLijst({ achterstallig: [], doorgeschoven: [], vandaag: taken('V', 1) });
    expect(screen.getByText('Mijn werkzaamheden')).toBeTruthy();
  });

  it('toont de groepen in vaste volgorde met tellers; vandaag-teller = doorgeschoven + vandaag', () => {
    renderLijst({ achterstallig: taken('A', 2), doorgeschoven: taken('D', 3), vandaag: taken('V', 1) });
    const groepen = screen.getAllByTestId(/^werklijst-groep-/).map(el => el.getAttribute('data-testid'));
    expect(groepen).toEqual(['werklijst-groep-achterstallig', 'werklijst-groep-doorgeschoven', 'werklijst-groep-vandaag']);
    expect(screen.getByText('4 voor vandaag')).toBeTruthy();
    expect(screen.getByText('2 achterstallig')).toBeTruthy();
  });

  // jsdom past geen CSS toe: zichtbaarheid wordt via de klassen per breakpoint getest.
  const zichtbaarDesktop = (el: Element) => !/(^| )hidden( |$)/.test(el.className) || /lg:block/.test(el.className);
  const zichtbaarDesktopNa = (el: Element) => zichtbaarDesktop(el) && !/lg:hidden/.test(el.className);
  const zichtbaarMobiel = (el: Element) => !/(^| )hidden( |$)/.test(el.className);

  it('desktop: maximaal 5 per groep en een link naar Taken voor de rest', () => {
    renderLijst({ achterstallig: [], doorgeschoven: taken('D', 7), vandaag: [] });
    const rijen = screen.getAllByTestId('werklijst-taak');
    expect(rijen.filter(zichtbaarDesktopNa)).toHaveLength(5);
    const link = screen.getByTestId('werklijst-naar-taken');
    expect(link.textContent).toBe('Bekijk alle (7) in Taken');
    expect(link.className).toContain('hidden lg:block');
    expect(screen.getByTestId('werklijst-toon-meer').className).toContain('lg:hidden');
  });

  it('mobiel: standaard 3 per groep; Toon meer maakt alle taken van de groep zichtbaar', () => {
    renderLijst({ achterstallig: [], doorgeschoven: taken('D', 7), vandaag: [] });
    const knop = screen.getByTestId('werklijst-toon-meer');
    expect(knop.textContent).toBe('Toon meer (4)');
    expect(screen.getAllByTestId('werklijst-taak').filter(zichtbaarMobiel)).toHaveLength(3);
    fireEvent.click(knop);
    expect(knop.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByTestId('werklijst-taak').filter(zichtbaarMobiel)).toHaveLength(7);
    // desktop blijft ook uitgeklapt op 5 met de link
    expect(screen.getAllByTestId('werklijst-taak').filter(zichtbaarDesktopNa)).toHaveLength(5);
    fireEvent.click(knop);
    expect(knop.textContent).toBe('Toon meer (4)');
  });

  it('alle taken staan in de lijst, in dezelfde volgorde en in de juiste groep', () => {
    const groups = { achterstallig: taken('A', 4), doorgeschoven: taken('D', 6), vandaag: taken('V', 2) };
    renderLijst(groups);
    for (const [naam, lijst] of [['achterstallig', groups.achterstallig], ['doorgeschoven', groups.doorgeschoven], ['vandaag', groups.vandaag]] as const) {
      const groep = screen.getByTestId(`werklijst-groep-${naam}`);
      expect(within(groep).getAllByTestId('rij').map(r => r.textContent)).toEqual(lijst.map(t => t.titel));
      expect(within(groep).getByText(String(lijst.length))).toBeTruthy();
    }
    expect(screen.getByText('8 voor vandaag')).toBeTruthy();
    expect(screen.getByText('4 achterstallig')).toBeTruthy();
  });

  it('elke groep klapt los uit; groepen tot 3 taken hebben geen Toon meer', () => {
    renderLijst({ achterstallig: taken('A', 5), doorgeschoven: taken('D', 5), vandaag: taken('V', 3) });
    const [a, d] = screen.getAllByTestId('werklijst-toon-meer');
    expect(screen.getAllByTestId('werklijst-toon-meer')).toHaveLength(2);
    fireEvent.click(a);
    expect(a.getAttribute('aria-expanded')).toBe('true');
    expect(d.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('werklijst-naar-taken')).toBeNull();
  });

  it('zichtbaarheidsregel per positie', () => {
    expect(werklijstZichtbaarheid(2, false)).toBe('');
    expect(werklijstZichtbaarheid(3, false)).toBe('hidden lg:block');
    expect(werklijstZichtbaarheid(5, false)).toBe('hidden');
    expect(werklijstZichtbaarheid(3, true)).toBe('');
    expect(werklijstZichtbaarheid(5, true)).toBe('lg:hidden');
  });

  it('laat lege groepen weg', () => {
    renderLijst({ achterstallig: [], doorgeschoven: [], vandaag: taken('V', 2) });
    expect(screen.queryByTestId('werklijst-groep-achterstallig')).toBeNull();
    expect(screen.queryByTestId('werklijst-groep-doorgeschoven')).toBeNull();
    expect(screen.getByTestId('werklijst-groep-vandaag')).toBeTruthy();
  });

  it('zonder werk: melding plus snelinvoer voor vandaag', () => {
    renderLijst({ achterstallig: [], doorgeschoven: [], vandaag: [] });
    expect(screen.getByText('Niets gepland voor vandaag.')).toBeTruthy();
    expect(screen.getByTestId('quick-capture').textContent).toBe('today');
  });
});

describe('DashboardKengetallen', () => {
  const renderK = (props: Partial<React.ComponentProps<typeof DashboardKengetallen>> = {}) =>
    render(<MemoryRouter><DashboardKengetallen aanbodvolume={{ totaal: 12630000, zonderVraagprijs: 0 }} courtage={51950} objectenZonderFee={0} actieveObjecten={12} achterstallig={0} {...props} /></MemoryRouter>);

  it('toont vier KPI-kaarten in vaste volgorde met hun links', () => {
    renderK();
    const labels = ['Actief aanbodvolume', 'Verwachte courtage', 'Actieve objecten', 'Achterstallige taken'];
    for (const l of labels) expect(screen.getByText(l)).toBeTruthy();
    const links = screen.getAllByRole('link');
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/objecten', '/rapportage', '/objecten', '/taken']);
    expect(links.map(a => a.querySelector('p')?.textContent)).toEqual(labels);
  });

  it('2×2 op mobiel en vier naast elkaar op desktop', () => {
    renderK();
    const rij = screen.getByTestId('dashboard-kengetallen');
    expect(rij.className).toContain('grid-cols-2');
    expect(rij.className).toContain('lg:grid-cols-4');
  });

  it('meldt objecten zonder vraagprijs, zodat duidelijk is dat het totaal onvolledig kan zijn', () => {
    renderK({ aanbodvolume: { totaal: 11868000, zonderVraagprijs: 4 } });
    expect(screen.getByText('4 objecten zonder vraagprijs')).toBeTruthy();
  });

  it('toont "—" zonder courtage en het aantal objecten zonder fee', () => {
    renderK({ courtage: 0, objectenZonderFee: 10 });
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('10 objecten zonder fee')).toBeTruthy();
  });

  it('kleurt achterstallig alleen rood boven nul', () => {
    const { unmount } = renderK({ achterstallig: 0 });
    expect(screen.getByText('0', { selector: 'p' }).className).not.toContain('text-destructive');
    unmount();
    renderK({ achterstallig: 10 });
    expect(screen.getByText('10').className).toContain('text-destructive');
  });
});
