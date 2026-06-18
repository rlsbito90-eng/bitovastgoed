// Brieven V2 — klik op kaart/rij opent bestaande brief via initialBrief,
// en actieknop binnen rij triggert geen rij-click (stopPropagation).
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import GeadresseerdeKaart from '@/components/offmarket/brieven/GeadresseerdeKaart';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function maakBrief(p: Partial<OffMarketBrief> = {}): OffMarketBrief {
  return {
    id: 'b-1',
    signaal_id: 's1',
    eigenaar_naam: 'Eigenaar Alfa',
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Demostraat 1\n1000 AA Voorbeeldstad',
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: 'Onderwerp', brieftekst: 'Tekst',
    status: 'concept', verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    ...p,
  } as OffMarketBrief;
}

describe('Brieven V2 — klikgedrag', () => {
  it('klik op rij roept onOpenBrief met bestaande brief', () => {
    const brief = maakBrief({ id: 'b-1' });
    const onOpen = vi.fn();
    const onDownload = vi.fn();
    const groep = groepeerBrievenPerGeadresseerde([brief])[0];

    const { getByTestId } = render(
      <GeadresseerdeKaart
        groep={groep}
        onOpenBrief={onOpen}
        onNieuweBrief={() => {}}
        onDownloadPdf={onDownload}
        onKopieer={() => {}}
        onMarkeerVerstuurd={() => {}}
      />,
    );
    fireEvent.click(getByTestId('stap-rij-brief_1'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-1' }));
  });

  it('actieknop binnen rij triggert geen rij-click', () => {
    const brief = maakBrief({ id: 'b-1' });
    const onOpen = vi.fn();
    const onDownload = vi.fn();
    const groep = groepeerBrievenPerGeadresseerde([brief])[0];

    const { getByLabelText } = render(
      <GeadresseerdeKaart
        groep={groep}
        onOpenBrief={onOpen}
        onNieuweBrief={() => {}}
        onDownloadPdf={onDownload}
        onKopieer={() => {}}
        onMarkeerVerstuurd={() => {}}
      />,
    );
    fireEvent.click(getByLabelText('Download PDF'));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
