// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GemeentePicker from './GemeentePicker';

function Scherm({ provincies = [], initial = [] }: { provincies?: string[]; initial?: string[] }) {
  const [gekozen, setGekozen] = useState(initial);
  return <GemeentePicker provincies={provincies} gekozen={gekozen} onChange={setGekozen} />;
}

describe('Gemeenten onafhankelijk van provincies kiezen', () => {
  it('laat Apeldoorn en Deventer kiezen zonder geselecteerde provincies', () => {
    render(<Scherm />);
    const input = screen.getByRole('textbox', { name: 'Gemeente zoeken' });
    fireEvent.change(input, { target: { value: 'apel' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Apeldoorn' }));
    expect(screen.getByRole('button', { name: 'Verwijder gemeente Apeldoorn' })).toBeTruthy();

    fireEvent.change(input, { target: { value: 'deven' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Deventer' }));
    expect(screen.getByRole('button', { name: 'Verwijder gemeente Deventer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verwijder gemeente Apeldoorn' })).toBeTruthy();
  });

  it('een gekozen provincie beperkt de beschikbare gemeenten niet meer', () => {
    render(<Scherm provincies={['Gelderland']} initial={['Apeldoorn', 'Deventer']} />);
    const input = screen.getByRole('textbox', { name: 'Gemeente zoeken' });
    expect(screen.getByRole('button', { name: 'Verwijder gemeente Deventer' })).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Rotter' } });
    expect(screen.getByRole('checkbox', { name: 'Rotterdam' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Verwijder gemeente Deventer' }));
    expect(screen.queryByRole('button', { name: 'Verwijder gemeente Deventer' })).toBeNull();
  });

  it('biedt geen onnodige lijst totdat er twee letters zijn ingevuld', () => {
    render(<Scherm />);
    const input = screen.getByRole('textbox', { name: 'Gemeente zoeken' });
    expect(screen.queryByRole('group', { name: 'Gemeentezoekresultaten' })).toBeNull();
    fireEvent.change(input, { target: { value: 'D' } });
    expect(screen.queryByRole('group', { name: 'Gemeentezoekresultaten' })).toBeNull();
  });
});
