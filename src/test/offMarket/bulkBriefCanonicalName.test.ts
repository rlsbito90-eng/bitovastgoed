import { describe, expect, it } from 'vitest';
import { bouwKandidatenVoorSignaal, viewModelVoorPlanItem } from '@/lib/offMarket/acquisitie/bulkBrief';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

const signaal = {
  id: 'sig-naam',
  status: 'interessant',
  adres: 'Mercatorstraat 67-H',
  postcode: '1056 PZ',
  plaats: 'Amsterdam',
  eigenaar_naam: 'Larasati Hardjani Geboren 10-02-1937 te INDONESIE',
  eigenaar_bedrijfsnaam: null,
  eigenaar_verzendadres: 'Mercatorstr 67-H\n1056 PZ AMSTERDAM',
} as any as OffMarketSignaal;

function brief(naam: string, bedrijfsnaam: string | null = null): OffMarketBrief {
  return {
    id: 'brief-1',
    signaal_id: signaal.id,
    eigenaar_naam: naam,
    eigenaar_bedrijfsnaam: bedrijfsnaam,
    verzendadres: 'Mercatorstr 67-H\n1056 PZ AMSTERDAM',
    status: 'concept',
    archived_at: null,
    created_at: '2026-08-18T00:00:00Z',
    updated_at: '2026-08-18T00:00:00Z',
    kanaal: 'post',
    campagne_stap: 'brief_1',
    geadresseerde_key: 'persoon-1',
  } as any as OffMarketBrief;
}

describe('bulkbrief — canonieke geadresseerdenaam', () => {
  it('verwijdert Kadaster-geboortegegevens en kort natuurlijke personen af', () => {
    const kandidaten = bouwKandidatenVoorSignaal(signaal, [
      brief('Larasati Hardjani Geboren 10-02-1937 te INDONESIE'),
    ]);
    expect(kandidaten[0].naam).toBe('L. Hardjani');
    expect(kandidaten[0].naam).not.toMatch(/Geboren/i);
  });

  it('normaliseert ook de signaal-fallback wanneer nog geen brief bestaat', () => {
    const kandidaten = bouwKandidatenVoorSignaal(signaal, []);
    expect(kandidaten[0].naam).toBe('L. Hardjani');
  });

  it('houdt rechtspersonen intact', () => {
    const kandidaten = bouwKandidatenVoorSignaal(signaal, [
      brief('Libra International B.V.'),
    ]);
    expect(kandidaten[0].naam).toBe('Libra International B.V.');
  });

  it('normaliseert ook een bestaand concept in het brief-viewmodel', () => {
    const bestaandeBrief = brief('Willemien Westerman Holstijn Geboren 06-06-1960 te AMSTERDAM');
    const kandidaat = bouwKandidatenVoorSignaal(signaal, [bestaandeBrief])[0];
    const vm = viewModelVoorPlanItem({
      signaal,
      plan: {
        signaalId: signaal.id,
        geadresseerdeKey: 'persoon-1',
        campagneStap: 'brief_1',
        kanaal: 'post',
        actie: 'hergebruiken',
        bestaandeBrief,
        reden: null,
        kandidaat,
      },
    });
    expect(vm.geadresseerdeNaam).toBe('W.W. Holstijn');
    expect(vm.geadresseerdeNaam).not.toMatch(/Geboren/i);
  });
});
