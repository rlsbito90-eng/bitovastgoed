// @vitest-environment jsdom
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AandachtItem } from '@/lib/dashboard/aandacht';
import DashboardAandacht, { taakTitelVoor } from './DashboardAandacht';

const item = (id: string, over: Partial<AandachtItem> = {}): AandachtItem => ({
  objectId: id, titel: `Object ${id}`, signaal: 'geen_activiteit', label: '16 dagen geen activiteit',
  toelichting: 'Geen betekenisvolle opvolging geregistreerd', volgendeActie: 'kandidaat benaderen',
  extraSignalen: 0, overigeSignalen: [], dagenStil: 16, ...over,
});
const renderA = (props: Partial<React.ComponentProps<typeof DashboardAandacht>> = {}) =>
  render(<MemoryRouter><DashboardAandacht overzicht={{ items: [], onHold: [] }} {...props} /></MemoryRouter>);

describe('DashboardAandacht', () => {
  it('toont per object titel, signaal, toelichting en volgende actie, met link naar het object', () => {
    renderA({ overzicht: { items: [item('A', { signaal: 'open_bieding', label: 'Open bieding', toelichting: 'Ontvangen bod, reactie verkoper nodig', volgendeActie: 'verkoper opvolgen' })], onHold: [] } });
    expect(screen.getByText('Aandacht nodig')).toBeTruthy();
    expect(screen.getByText('Object A')).toBeTruthy();
    expect(screen.getByText('Open bieding')).toBeTruthy();
    expect(screen.getByText('Ontvangen bod, reactie verkoper nodig')).toBeTruthy();
    expect(screen.getByText('Volgende actie:', { exact: false })).toBeTruthy();
    expect(screen.getByText('verkoper opvolgen')).toBeTruthy();
    expect(screen.getByText('Object A').closest('a')?.getAttribute('href')).toBe('/objecten/A');
  });

  it('toont extra signalen als +n met uitleg', () => {
    renderA({ overzicht: { items: [item('A', { extraSignalen: 1, overigeSignalen: ['Geen kandidaat'] })], onHold: [] } });
    expect(screen.getByText('+1').getAttribute('title')).toBe('Ook: Geen kandidaat');
  });

  it('toont er maximaal 5 en kan de rest uitklappen', () => {
    renderA({ overzicht: { items: Array.from({ length: 7 }, (_, i) => item(`O${i}`)), onHold: [] } });
    expect(screen.getAllByTestId('aandacht-regel')).toHaveLength(5);
    fireEvent.click(screen.getByText('Toon alle (7)'));
    expect(screen.getAllByTestId('aandacht-regel')).toHaveLength(7);
  });

  it('on hold staat apart en ingeklapt', () => {
    renderA({ overzicht: { items: [], onHold: [item('H', { signaal: 'on_hold', label: 'On hold' })] } });
    expect(screen.queryByTestId('aandacht-on-hold')).toBeNull();
    fireEvent.click(screen.getByText('On hold (1)'));
    expect(screen.getByTestId('aandacht-on-hold')).toBeTruthy();
  });

  it('plannen geeft het object door', () => {
    const onPlan = vi.fn();
    renderA({ overzicht: { items: [item('A')], onHold: [] }, onPlanOpvolging: onPlan });
    fireEvent.click(screen.getByLabelText('Opvolging plannen voor Object A'));
    expect(onPlan).toHaveBeenCalledWith(expect.objectContaining({ objectId: 'A' }));
  });

  it('lege staat, laadstatus en foutmelding', () => {
    const { unmount } = renderA();
    expect(screen.getByText('Geen objecten die nu aandacht vragen')).toBeTruthy();
    unmount();
    const r = renderA({ overzicht: { items: [item('A')], onHold: [] }, status: 'laden' });
    expect(screen.getByText('Biedingen laden…')).toBeTruthy();
    expect(screen.queryByTestId('aandacht-regel')).toBeNull();
    r.unmount();
    renderA({ overzicht: { items: [item('A')], onHold: [] }, status: 'fout' });
    expect(screen.getByTestId('aandacht-fout')).toBeTruthy();
  });

  it('taaktitel: vervolgstap met hoofdletter, zonder planningstoevoeging', () => {
    expect(taakTitelVoor(item('A'))).toBe('Kandidaat benaderen');
    expect(taakTitelVoor(item('A', { volgendeActie: 'Bellen (achterstallig sinds 3 nov)' }))).toBe('Bellen');
  });
});
