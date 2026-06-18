// Brieven V2 — opschoon: verstuurd / gekoppelde taak / niet-concept verzendstatus.
import { describe, it, expect } from 'vitest';
import { veiligeOpschoonkandidaten } from '@/lib/offMarket/brieven/opschoon';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function b(p: Partial<OffMarketBrief> & { id: string }): OffMarketBrief {
  return {
    signaal_id: 's1',
    eigenaar_naam: 'Eigenaar Alfa',
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Demostraat 1\n1000 AA Voorbeeldstad',
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: '',
    status: 'concept', verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    ...p,
  } as OffMarketBrief;
}

describe('opschoon — V2 veiligheidsregels', () => {
  it('verstuurde brief is nooit kandidaat', () => {
    const brieven: any[] = [
      b({ id: 'a-oud', created_at: '2026-06-01T10:00:00Z' }),
      b({ id: 'a-nieuw', created_at: '2026-06-02T10:00:00Z',
          status: 'verstuurd', verzonden_op: '2026-06-02T12:00Z', verzendstatus: 'gepost' }),
    ];
    const k = veiligeOpschoonkandidaten(brieven, []);
    expect(k.find((x) => x.brief.id === 'a-nieuw')).toBeUndefined();
  });

  it('brieven met gekoppelde_taak_id worden uitgesloten', () => {
    const brieven: any[] = [
      b({ id: 'a-oud', created_at: '2026-06-01T10:00:00Z', gekoppelde_taak_id: 't-1' }),
      b({ id: 'a-nieuw', created_at: '2026-06-02T10:00:00Z' }),
    ];
    const k = veiligeOpschoonkandidaten(brieven, []);
    expect(k.find((x) => x.brief.id === 'a-oud')).toBeUndefined();
  });

  it('brieven met verzendstatus=geprint/gepost zijn nooit kandidaat', () => {
    const brieven: any[] = [
      b({ id: 'a-oud', created_at: '2026-06-01T10:00:00Z', verzendstatus: 'geprint' }),
      b({ id: 'a-nieuw', created_at: '2026-06-02T10:00:00Z' }),
    ];
    const k = veiligeOpschoonkandidaten(brieven, []);
    expect(k.find((x) => x.brief.id === 'a-oud')).toBeUndefined();
  });

  it('oude conceptversie zonder beperkingen is wel kandidaat', () => {
    const brieven: any[] = [
      b({ id: 'a-oud', created_at: '2026-06-01T10:00:00Z' }),
      b({ id: 'a-nieuw', created_at: '2026-06-02T10:00:00Z' }),
    ];
    const k = veiligeOpschoonkandidaten(brieven, []);
    expect(k.find((x) => x.brief.id === 'a-oud')).toBeDefined();
  });
});
