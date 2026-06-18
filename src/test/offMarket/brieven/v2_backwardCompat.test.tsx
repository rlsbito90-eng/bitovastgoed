// Brieven V2 — backward compatibility: oude records zonder V2-velden
// renderen zonder fouten in GeadresseerdeKaart.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GeadresseerdeKaart from '@/components/offmarket/brieven/GeadresseerdeKaart';
import {
  groepeerBrievenPerGeadresseerde,
} from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function oudeBrief(id: string): OffMarketBrief {
  return {
    id,
    signaal_id: 's1',
    eigenaar_naam: 'Eigenaar Alfa',
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Demostraat 1\n1000 AA Voorbeeldstad',
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: 'Tekst',
    status: 'concept', verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2025-01-01T10:00:00Z', updated_at: '2025-01-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    // BEWUST geen V2 velden zoals kanaal, campagne_stap, geadresseerde_key, etc.
  } as OffMarketBrief;
}

describe('Brieven V2 — backward compatibility', () => {
  it('oude records zonder V2-velden renderen zonder errors', () => {
    const brieven = [oudeBrief('oud-1')];
    const groep = groepeerBrievenPerGeadresseerde(brieven)[0];
    expect(groep).toBeDefined();

    const { container, getByTestId } = render(
      <GeadresseerdeKaart
        groep={groep}
        onOpenBrief={() => {}}
        onNieuweBrief={() => {}}
        onDownloadPdf={() => {}}
        onKopieer={() => {}}
        onMarkeerVerstuurd={() => {}}
      />,
    );
    expect(container).toBeTruthy();
    expect(getByTestId('geadresseerde-kaart')).toBeInTheDocument();
    expect(getByTestId('stap-rij-brief_1')).toBeInTheDocument();
  });
});
