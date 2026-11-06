// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Taak } from '@/data/mock-data';
import DashboardWerklijst from './DashboardWerklijst';
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
  it('toont de groepen in vaste volgorde met tellers; vandaag-teller = doorgeschoven + vandaag', () => {
    renderLijst({ achterstallig: taken('A', 2), doorgeschoven: taken('D', 3), vandaag: taken('V', 1) });
    const groepen = screen.getAllByTestId(/^werklijst-groep-/).map(el => el.getAttribute('data-testid'));
    expect(groepen).toEqual(['werklijst-groep-achterstallig', 'werklijst-groep-doorgeschoven', 'werklijst-groep-vandaag']);
    expect(screen.getByText('4 voor vandaag')).toBeTruthy();
    expect(screen.getByText('2 achterstallig')).toBeTruthy();
  });

  it('toont maximaal 5 per groep en verwijst naar Taken voor de rest', () => {
    renderLijst({ achterstallig: [], doorgeschoven: taken('D', 7), vandaag: [] });
    expect(screen.getAllByTestId('rij')).toHaveLength(5);
    expect(screen.getByText('Bekijk alle (7) in Taken')).toBeTruthy();
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
    render(<MemoryRouter><DashboardKengetallen aanbodvolume={12630000} beschikbaar={8} courtage={51950} objectenZonderFee={0} actieveObjecten={12} achterstallig={0} {...props} /></MemoryRouter>);

  it('toont het aanbodvolume als hoofdcijfer en daaronder drie kengetallen met hun links', () => {
    renderK();
    expect(screen.getByText('Actief aanbodvolume')).toBeTruthy();
    expect(screen.getByText('8 direct beschikbaar')).toBeTruthy();
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(links).toEqual(['/objecten', '/rapportage', '/objecten', '/taken']);
    expect(screen.getByText('Verwachte courtage')).toBeTruthy();
    expect(screen.getByText('Actieve objecten')).toBeTruthy();
    expect(screen.getByText('Achterstallige taken')).toBeTruthy();
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
