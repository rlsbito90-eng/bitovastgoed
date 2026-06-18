// V2.2 — GeadresseerdeKaart toont een E-mail kanaalbadge wanneer er e-mailbrieven zijn.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GeadresseerdeKaart from '@/components/offmarket/brieven/GeadresseerdeKaart';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function brief(p: Partial<OffMarketBrief> = {}): OffMarketBrief {
  return {
    id: 'b-' + Math.random().toString(36).slice(2),
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
    kanaal: 'post', campagne_stap: 'brief_1',
    ...p,
  } as OffMarketBrief;
}

describe('GeadresseerdeKaart — V2.2 e-mailbadge en stappen', () => {
  it('toont E-mailbadge en email_1-rij wanneer er een e-mail-brief is', () => {
    const groep = groepeerBrievenPerGeadresseerde([
      brief({ id: 'p1', kanaal: 'post', campagne_stap: 'brief_1' }),
      brief({ id: 'e1', kanaal: 'email', campagne_stap: 'email_1', status: 'verstuurd', verzonden_op: '2026-06-02T00:00:00Z' }),
    ])[0];
    const { getByTestId, getByText } = render(
      <GeadresseerdeKaart
        groep={groep}
        onOpenBrief={() => {}}
        onNieuweBrief={() => {}}
        onDownloadPdf={() => {}}
        onKopieer={() => {}}
        onMarkeerVerstuurd={() => {}}
      />,
    );
    expect(getByTestId(`kanaalbadge-email-${groep.key}`)).toBeInTheDocument();
    expect(getByTestId('email-stappen-lijst')).toBeInTheDocument();
    expect(getByText('E-mail 1')).toBeInTheDocument();
  });

  it('toont GEEN e-mail-blok als er alleen post-brieven zijn', () => {
    const groep = groepeerBrievenPerGeadresseerde([
      brief({ id: 'p1', kanaal: 'post', campagne_stap: 'brief_1' }),
    ])[0];
    const { queryByTestId } = render(
      <GeadresseerdeKaart
        groep={groep}
        onOpenBrief={() => {}}
        onNieuweBrief={() => {}}
        onDownloadPdf={() => {}}
        onKopieer={() => {}}
        onMarkeerVerstuurd={() => {}}
      />,
    );
    expect(queryByTestId(`kanaalbadge-email-${groep.key}`)).toBeNull();
    expect(queryByTestId('email-stappen-lijst')).toBeNull();
  });
});
