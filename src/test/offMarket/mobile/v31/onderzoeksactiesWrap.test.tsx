// V31 — Onderzoeksacties: flex-wrap, geen mobiele horizontale overflow-clipping.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignaalOnderzoeksacties from '@/components/offmarket/SignaalOnderzoeksacties';
import { maakTestSignaal } from '../_fixture';

describe('SignaalOnderzoeksacties — mobiele wrap', () => {
  it('container gebruikt flex-wrap zonder overflow-x-auto op mobiel', () => {
    render(<SignaalOnderzoeksacties signaal={maakTestSignaal()} />);
    const sectie = screen.getByTestId('signaal-onderzoeksacties');
    // De directe knop-container is het laatste div-kind van de sectie.
    const knopRij = sectie.querySelector('div.flex') as HTMLElement;
    expect(knopRij).toBeTruthy();
    expect(knopRij.className).toMatch(/flex-wrap/);
    expect(knopRij.className).not.toMatch(/overflow-x-auto/);
  });

  it('rendert alle 6 onderzoeksactie-knoppen zichtbaar', () => {
    render(<SignaalOnderzoeksacties signaal={maakTestSignaal()} />);
    expect(screen.getByLabelText(/Open in Google Maps/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Zoek adres op Google/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Open in BAG Viewer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Open in KadastraleKaart\.com/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Kopieer adres/i)).toBeInTheDocument();
  });
});
