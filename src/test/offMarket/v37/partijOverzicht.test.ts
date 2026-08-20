import { describe, expect, it } from 'vitest';
import { bouwPartijenOverzicht, partijKeyVoorKandidaat, partijWaarschuwing } from '@/lib/offMarket/acquisitie/partijOverzicht';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

function signaal(id: string, adres: string, bedrijf: string): OffMarketSignaal {
  return {
    id,
    adres,
    plaats: 'Amsterdam',
    status: 'eigenaar_gevonden',
    type_signaal: 'vergunning_bekendmaking',
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: bedrijf,
    eigenaar_verzendadres: 'Herengracht 1\n1015 AA Amsterdam',
  } as any;
}

function brief(id: string, signaalId: string, bedrijf: string, responsstatus: string | null = null): OffMarketBrief {
  return {
    id,
    signaal_id: signaalId,
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: bedrijf,
    verzendadres: 'Herengracht 1\n1015 AA Amsterdam',
    objectadres: null,
    objectomschrijving: null,
    aanhef: null,
    onderwerp: null,
    brieftekst: 'tekst',
    status: 'verstuurd',
    verzonden_op: '2026-08-10T10:00:00Z',
    aangemaakt_door: null,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    archived_at: null,
    archived_reason: null,
    responsstatus,
    responsdatum: responsstatus ? '2026-08-12' : null,
  } as OffMarketBrief;
}

describe('partijOverzicht', () => {
  it('groepeert dezelfde BV over meerdere objecten ondanks schrijfwijze van B.V.', () => {
    const partijen = bouwPartijenOverzicht([
      signaal('s1', 'Keizersgracht 1', 'Voorbeeld Vastgoed B.V.'),
      signaal('s2', 'Prinsengracht 2', 'Voorbeeld Vastgoed BV'),
    ], [brief('b1', 's1', 'Voorbeeld Vastgoed B.V.')]);

    expect(partijen).toHaveLength(1);
    expect(partijen[0].objecten).toHaveLength(2);
    expect(partijen[0].verstuurdAantal).toBe(1);
    expect(partijen[0].advies).toBe('recent_benaderd');
    expect(partijWaarschuwing(partijen[0])).toMatch(/recent al aangeschreven/i);
  });

  it('houdt natuurlijke personen met dezelfde naam op verschillende postadressen apart', () => {
    const a = partijKeyVoorKandidaat({ naam: 'J. de Vries', bedrijfsnaam: null, verzendadres: 'Straat 1\n1000 AA A' });
    const b = partijKeyVoorKandidaat({ naam: 'J. de Vries', bedrijfsnaam: null, verzendadres: 'Straat 2\n1000 BB B' });
    expect(a).not.toBe(b);
  });

  it('adviseert geen nieuwe koude brief na negatieve reactie', () => {
    const partijen = bouwPartijenOverzicht(
      [signaal('s1', 'Keizersgracht 1', 'Stop B.V.')],
      [brief('b1', 's1', 'Stop B.V.', 'niet_geinteresseerd')],
    );
    expect(partijen[0].advies).toBe('niet_opnieuw');
  });
});
