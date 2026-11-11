// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlaatsenPicker from './PlaatsenPicker';
import { zoekPdokWoonplaatsen } from '@/lib/bag/pdokLookup';

vi.mock('@/lib/bag/pdokLookup', () => ({
  zoekPdokWoonplaatsen: vi.fn(async (zoektekst: string) => {
    const namen = ['Apeldoorn', 'Deventer', 'Den Haag'];
    return namen
      .filter(naam => naam.toLowerCase().includes(zoektekst.toLowerCase()))
      .map((naam, index) => ({
        id: 'pdok-' + index,
        woonplaats: naam,
        weergavenaam: naam,
        type: 'woonplaats',
      }));
  }),
}));

function TestPicker({ initial = [] }: { initial?: string[] }) {
  const [plaatsen, setPlaatsen] = useState(initial);
  return <PlaatsenPicker gekozen={plaatsen} onChange={setPlaatsen} label="Plaatsen" />;
}

afterEach(() => { vi.clearAllMocks(); });

describe('Officiële woonplaatsen als meerkeuzeselectie', () => {
  it('vindt Apeldoorn na typen, en bewaart Deventer als tweede keuze', async () => {
    render(<TestPicker />);
    const veld = screen.getByRole('textbox', { name: 'Plaatsen' });
    fireEvent.change(veld, { target: { value: 'Apel' } });
    const apel = await screen.findByRole('checkbox', { name: 'Apeldoorn' });
    fireEvent.click(apel);
    expect(screen.getByRole('button', { name: 'Verwijder plaats Apeldoorn' })).toBeTruthy();

    fireEvent.change(veld, { target: { value: 'Deven' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Deventer' }));
    expect(screen.getByRole('button', { name: 'Verwijder plaats Deventer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verwijder plaats Apeldoorn' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Verwijder plaats Apeldoorn' }));
    expect(screen.queryByRole('button', { name: 'Verwijder plaats Apeldoorn' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Verwijder plaats Deventer' })).toBeTruthy();
  });

  it('bewaart historische plaatsen en zoekt niet bij alleen openen', async () => {
    render(<TestPicker initial={['Breda', 'Tilburg']} />);
    expect(screen.getByRole('button', { name: 'Verwijder plaats Breda' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verwijder plaats Tilburg' })).toBeTruthy();
    await waitFor(() => expect(zoekPdokWoonplaatsen).not.toHaveBeenCalled());
  });
});
