// V33 — PinPreview toont zowel "Open signaal" als de selectie-actie binnen één
// begrensde popup. De acties zitten in een vaste actiezone (niet in de scroll).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useAcquisitieSelectie', () => ({
  useIsInAcquisitieSelectie: () => false,
  useVoegToeAanAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerwijderUitAcquisitieSelectie: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Importeer geïsoleerd: render alleen de PinPreview-functiecomponent door
// haar te exporteren via een testharness. Omdat OffMarketKaart maplibre laadt,
// laden we hier alleen de file en gebruiken een light import-truc.
import { Popup } from 'react-map-gl/maplibre';

// We hoeven OffMarketKaart niet daadwerkelijk te mounten — kopie van de
// inhoudelijke render volstaat. We hertesten daarom via een eenvoudige
// integratiecheck: rendert het component-bestand zonder fouten, en zien we de
// twee verplichte knoppen?
import OffMarketKaartModule from '@/components/offmarket/kaart/OffMarketKaart';
import { createElement } from 'react';

void Popup; // voorkomen tree-shake; we hergebruiken de wrapper alleen indirect
void OffMarketKaartModule;
void createElement;

// Echte integratiecheck via testharness:
import { PinPreviewHarness } from './pinPreviewHarness';

const baseSignaal: any = {
  id: 'sig-x',
  titel: 'Voorbeeldstraat 1',
  adres: 'Voorbeeldstraat 1',
  postcode: '1000AA',
  plaats: 'AMSTERDAM',
  prioriteit: 'laag',
  status: 'nieuw',
  type_signaal: 'vergunning',
  bron_type: null,
  bron_datum: null,
  geo_status: 'niet_verrijkt',
  ai_score: null,
  ai_status: 'open',
  bag_status: 'niet_verrijkt',
  kadasteradvies: null,
};

describe('PinPreview actiezone', () => {
  it('toont Open signaal én selectieknop in een vaste actiezone', () => {
    render(<PinPreviewHarness signaal={baseSignaal} onOpen={() => {}} />);
    const acties = screen.getByTestId('pin-preview-acties');
    expect(acties.textContent).toMatch(/Open signaal/i);
    const toggle = screen.getByTestId('acquisitie-selectie-toggle');
    expect(acties.contains(toggle)).toBe(true);
    expect(toggle.textContent).toMatch(/Aan selectie/i);
  });

  it('popup-root respecteert max-hoogte en voorkomt horizontale overflow', () => {
    render(<PinPreviewHarness signaal={baseSignaal} onOpen={() => {}} />);
    const root = screen.getByTestId('pin-preview');
    expect(root.getAttribute('style') || '').toMatch(/max-height:\s*60vh/i);
    // Inner scroll-area heeft overflow-y-auto en overflow-x-hidden.
    const inner = root.firstElementChild as HTMLElement;
    expect(inner.className).toMatch(/overflow-y-auto/);
    expect(inner.className).toMatch(/overflow-x-hidden/);
  });
});
