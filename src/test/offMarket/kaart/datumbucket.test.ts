import { describe, it, expect } from 'vitest';
import { matchBucket, isActueel, isKomend, isHistorisch } from '@/lib/offMarket/kaart/datumbucket';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const now = new Date('2026-06-11T12:00:00Z');

function s(p: Partial<OffMarketSignaal>): OffMarketSignaal {
  return {
    id: 'x', titel: 't', status: 'nieuw_signaal' as never, prioriteit: 'midden' as never,
    type_signaal: 'overig' as never, assettype: 'overig' as never, bron_type: 'handmatig' as never,
    bron_datum: null, volgende_actie_datum: null, gearchiveerd_op: null,
    ...p,
  } as unknown as OffMarketSignaal;
}

describe('datumbucket', () => {
  it('actueel zonder bron_datum', () => {
    expect(isActueel(s({}), now)).toBe(true);
  });
  it('actueel binnen 90 dagen', () => {
    expect(isActueel(s({ bron_datum: '2026-04-15' as never }), now)).toBe(true);
  });
  it('komend bij toekomstige volgende actie', () => {
    expect(isKomend(s({ volgende_actie_datum: '2026-07-01' as never }), now)).toBe(true);
  });
  it('historisch bij archief', () => {
    expect(isHistorisch(s({ gearchiveerd_op: '2026-01-01' as never }), now)).toBe(true);
  });
  it('historisch bij oude bron_datum', () => {
    expect(isHistorisch(s({ bron_datum: '2025-01-01' as never }), now)).toBe(true);
  });
  it('matchBucket alles altijd waar', () => {
    expect(matchBucket(s({}), 'alles', now)).toBe(true);
  });
});
