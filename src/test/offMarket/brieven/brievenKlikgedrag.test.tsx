import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GeadresseerdeKaart from '@/components/offmarket/brieven/GeadresseerdeKaart';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function brief(p: Partial<OffMarketBrief> & { id: string }): OffMarketBrief {
  return {
    signaal_id: 's1',
    eigenaar_naam: 'Eigenaar Test', eigenaar_bedrijfsnaam: null,
    verzendadres: 'Demostraat 1',
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: '',
    status: 'concept', verzonden_op: null, aangemaakt_door: null,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    ...p,
  } as OffMarketBrief;
}

describe('Brieven — klikgedrag', () => {
  it('klik op briefrij opent actieve brief; PDF-knop triggert alleen PDF', () => {
    const onOpen = vi.fn();
    const onPdf = vi.fn();
    const groep = groepeerBrievenPerGeadresseerde([
      brief({ id: 'oud', created_at: '2026-06-01T10:00:00Z' }),
      brief({ id: 'actief', created_at: '2026-06-05T10:00:00Z' }),
    ])[0];

    render(
      <GeadresseerdeKaart
        groep={groep}
        onOpenBrief={onOpen} onNieuweBrief={() => {}}
        onDownloadPdf={onPdf} onKopieer={() => {}} onMarkeerVerstuurd={() => {}}
      />,
    );

    const rij = screen.getByTestId('stap-rij-brief_1');
    fireEvent.click(rij);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].id).toBe('actief');

    const pdfKnop = screen.getByTitle('Download PDF');
    fireEvent.click(pdfKnop);
    expect(onPdf).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1); // geen extra rij-click

    // Open oudere conceptversies
    fireEvent.click(screen.getByTestId('oudere-concepten-toggle-brief_1'));
    const ouder = screen.getByTestId('ouder-concept-oud');
    fireEvent.click(ouder);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen.mock.calls[1][0].id).toBe('oud');
  });
});
