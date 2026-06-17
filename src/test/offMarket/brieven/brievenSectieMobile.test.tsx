import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import GeadresseerdeKaart from '@/components/offmarket/brieven/GeadresseerdeKaart';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function brief(p: Partial<OffMarketBrief> & { id: string; eigenaar_naam: string }): OffMarketBrief {
  return {
    signaal_id: 's1', eigenaar_bedrijfsnaam: null,
    verzendadres: 'Demostraat 1',
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: '',
    status: 'concept', verzonden_op: null, aangemaakt_door: null,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    ...p,
  } as OffMarketBrief;
}

describe('Brieven & opvolging — vier geadresseerden', () => {
  it('toont 4 kaarten, elk met Brief 1, nooit Brief 4', () => {
    const brieven = ['Alfa', 'Bravo', 'Charlie', 'Delta'].map((n, i) =>
      brief({ id: String(i), eigenaar_naam: `Eigenaar ${n}`, verzendadres: `Straat ${i}` }),
    );
    const groepen = groepeerBrievenPerGeadresseerde(brieven);
    expect(groepen).toHaveLength(4);

    const { container } = render(
      <>
        {groepen.map((g) => (
          <GeadresseerdeKaart
            key={g.key} groep={g}
            onOpenBrief={() => {}} onNieuweBrief={() => {}}
            onDownloadPdf={() => {}} onKopieer={() => {}} onMarkeerVerstuurd={() => {}}
          />
        ))}
      </>,
    );

    const kaarten = screen.getAllByTestId('geadresseerde-kaart');
    expect(kaarten).toHaveLength(4);
    for (const k of kaarten) {
      expect(within(k).getByText('Brief 1')).toBeTruthy();
    }
    expect(container.textContent).not.toMatch(/Brief\s*4/);
    expect(container.textContent).not.toMatch(/Brief\s*5/);
  });
});
