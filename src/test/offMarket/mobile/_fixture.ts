// Fictieve testfixture voor een Off-Market signaal — uitsluitend generieke
// data, geen echte adressen, relaties of bedragen.
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export function maakTestSignaal(overrides: Partial<OffMarketSignaal> = {}): OffMarketSignaal {
  const base: any = {
    id: 'sig-test-001',
    titel: 'Testsignaal voor unit-tests',
    omschrijving: 'Korte omschrijving voor tests',
    assettype: 'wonen',
    type_signaal: 'overig',
    bron_type: 'handmatig',
    bron_url: null,
    bron_datum: '2026-06-01',
    status: 'nieuw_signaal',
    prioriteit: 'laag',
    adres: 'Voorbeeldstraat 1',
    postcode: '0000 AA',
    plaats: 'Testdorp',
    potentiele_strategie: null,
    ai_strategie_suggestie: null,
    ai_score: 50,
    ai_verkoopkans: 0.5,
    ai_status: 'klaar',
    eigenaarstatus: 'onbekend',
    eigenaar_naam: null,
    eigenaar_relatie_id: null,
    gearchiveerd_op: null,
    notities: null,
    volgende_actie_datum: null,
    volgende_actie_omschrijving: null,
    lat: null,
    lng: null,
    geo_status: 'niet_verrijkt',
    geo_gemeente_naam: null,
    geo_wijk_naam: null,
    geo_buurt_naam: null,
    created_at: '2026-06-10T10:00:00.000Z',
    updated_at: '2026-06-10T10:00:00.000Z',
  };
  return { ...base, ...overrides } as OffMarketSignaal;
}
