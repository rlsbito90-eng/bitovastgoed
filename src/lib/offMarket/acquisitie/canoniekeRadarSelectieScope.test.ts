import { describe, expect, it } from 'vitest';

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import {
  bouwBriefPlan,
  bouwCanoniekeRadarSelectieScope,
} from './bulkBrief';

function signaal(id: string, overrides: Record<string, unknown> = {}): OffMarketSignaal {
  return {
    id,
    status: 'interessant',
    type_signaal: 'vergunning',
    adres: `Teststraat ${id}`,
    postcode: '1000 AA',
    plaats: 'Amsterdam',
    eigenaar_naam: `Eigenaar ${id}`,
    eigenaar_bedrijfsnaam: null,
    eigenaar_verzendadres: `Poststraat ${id}\n1000 AA Amsterdam`,
    ...overrides,
  } as unknown as OffMarketSignaal;
}

function brief(
  id: string,
  signaalId: string,
  key = `persoon-${signaalId}`,
  overrides: Partial<OffMarketBrief> = {},
): OffMarketBrief {
  return {
    id,
    signaal_id: signaalId,
    eigenaar_naam: `Eigenaar ${signaalId}`,
    eigenaar_bedrijfsnaam: null,
    verzendadres: `Poststraat ${signaalId}\n1000 AA Amsterdam`,
    objectadres: null,
    objectomschrijving: null,
    aanhef: 'Geachte heer/mevrouw,',
    onderwerp: 'Onderwerp',
    brieftekst: 'Tekst',
    status: 'concept',
    verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-08-26T08:00:00Z',
    updated_at: '2026-08-26T08:00:00Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'post',
    campagne_stap: 'brief_1',
    geadresseerde_key: key,
    ...overrides,
  } as OffMarketBrief;
}

describe('canonieke Radar-selectiescope', () => {
  it('houdt 10 geselecteerde signalen, geadresseerden en conceptbrieven in dezelfde scope', () => {
    const signalen = Array.from({ length: 10 }, (_, index) => signaal(`s${index + 1}`));
    const brieven = signalen.map((item, index) => brief(`b${index + 1}`, item.id));

    const scope = bouwCanoniekeRadarSelectieScope(signalen, brieven);

    expect(scope.telling).toMatchObject({
      signalen: 10,
      geadresseerden: 10,
      brievenVoorTeBereiden: 10,
      conceptbrieven: 10,
      nietGereed: 0,
    });
  });

  it('telt meerdere geadresseerden per signaal als aparte briefitems', () => {
    const scope = bouwCanoniekeRadarSelectieScope([signaal('s1')], [
      brief('b1', 's1', 'persoon-1'),
      brief('b2', 's1', 'persoon-2', { eigenaar_naam: 'Tweede eigenaar' }),
    ]);

    expect(scope.telling.signalen).toBe(1);
    expect(scope.telling.geadresseerden).toBe(2);
    expect(scope.telling.conceptbrieven).toBe(2);
  });

  it('dedupliceert een hergebruikt concept op signaal en geadresseerde-key', () => {
    const bestaand = brief('b1', 's1', 'persoon-1');
    const scope = bouwCanoniekeRadarSelectieScope([signaal('s1')], [bestaand]);
    const plan = bouwBriefPlan({
      kandidaten: scope.kandidaten,
      brieven: [bestaand],
      campagneStap: 'brief_1',
    });

    expect(scope.telling.geadresseerden).toBe(1);
    expect(plan).toHaveLength(1);
    expect(plan[0].actie).toBe('hergebruiken');
  });

  it('behoudt een gemengde selectie over Brief voorbereiden en Printen & posten', () => {
    const scope = bouwCanoniekeRadarSelectieScope(
      [signaal('voorbereiden'), signaal('printen')],
      [brief('def', 'printen', 'persoon-print', { status: 'definitief' })],
    );

    expect(scope.telling.signalen).toBe(2);
    expect(scope.telling.definitieveBrieven).toBe(1);
    expect(scope.nietGereed).toEqual([
      { signaalId: 'voorbereiden', briefId: null, reden: 'geen_actief_postconcept' },
    ]);
  });

  it('laat ontbrekende en ongeldige productie-items expliciet staan', () => {
    const scope = bouwCanoniekeRadarSelectieScope(
      [signaal('zonder'), signaal('onvolledig')],
      [brief('b-onvolledig', 'onvolledig', 'persoon-2', { verzendadres: 'Alleen een straat' })],
    );

    expect(scope.telling.signalen).toBe(2);
    expect(scope.telling.nietGereed).toBe(2);
    expect(scope.nietGereed.map((item) => item.reden)).toEqual([
      'geen_actief_postconcept',
      'postadres_onvolledig',
    ]);
  });
});
