import { describe, expect, it } from 'vitest';
import {
  bepaalFunnelStap,
  berekenBronAggregaat,
  berekenFunnelAggregaat,
  filterSignalen,
  isAfgevallen,
  signalenDieStageBereikten,
  signalenOpStage,
  stageRank,
  FUNNEL_STAGES,
} from '@/lib/acquisitie/funnel';
import type { OffMarketSignaal, OffMarketStatus, OffMarketEigenaarstatus } from '@/lib/offMarket/types';

// Minimal stub van OffMarketSignaal met alleen velden die de mapper raakt.
function maakSignaal(overrides: Partial<OffMarketSignaal> = {}): OffMarketSignaal {
  return {
    id: crypto.randomUUID(),
    titel: 'Test',
    status: 'nieuw_signaal' as OffMarketStatus,
    eigenaarstatus: 'onbekend' as OffMarketEigenaarstatus,
    gearchiveerd_op: null,
    plaats: 'Amsterdam',
    created_at: '2025-06-01T10:00:00Z',
    ...overrides,
  } as unknown as OffMarketSignaal;
}

describe('funnel-mapping', () => {
  it('nieuw signaal valt op stage "signaal"', () => {
    expect(bepaalFunnelStap(maakSignaal())).toBe('signaal');
  });

  it('twijfel telt nog als signaal', () => {
    expect(bepaalFunnelStap(maakSignaal({ status: 'twijfel' }))).toBe('signaal');
  });

  it('status mapt naar de juiste highwater stage', () => {
    expect(bepaalFunnelStap(maakSignaal({ status: 'interessant' }))).toBe('interessant');
    expect(bepaalFunnelStap(maakSignaal({ status: 'te_onderzoeken' }))).toBe('te_onderzoeken');
    expect(bepaalFunnelStap(maakSignaal({ status: 'eigenaar_achterhalen' }))).toBe('eigenaar_achterhalen');
    expect(bepaalFunnelStap(maakSignaal({ status: 'eigenaar_gevonden' }))).toBe('eigenaar_gevonden');
    expect(bepaalFunnelStap(maakSignaal({ status: 'benaderen' }))).toBe('eigenaar_gevonden');
    expect(bepaalFunnelStap(maakSignaal({ status: 'benaderd' }))).toBe('benaderd');
    expect(bepaalFunnelStap(maakSignaal({ status: 'in_gesprek' }))).toBe('in_gesprek');
    expect(bepaalFunnelStap(maakSignaal({ status: 'aanbod_ontvangen' }))).toBe('aanbod');
    expect(bepaalFunnelStap(maakSignaal({ status: 'object_ontvangen' }))).toBe('dealtraject');
    expect(bepaalFunnelStap(maakSignaal({ status: 'dealtraject' }))).toBe('dealtraject');
  });

  it('eigenaarstatus kan een hogere stage afdwingen dan status', () => {
    const s = maakSignaal({ status: 'nieuw_signaal', eigenaarstatus: 'in_gesprek' });
    expect(bepaalFunnelStap(s)).toBe('in_gesprek');
  });

  it('status wint als die hoger is dan eigenaarstatus', () => {
    const s = maakSignaal({ status: 'aanbod_ontvangen', eigenaarstatus: 'benaderd' });
    expect(bepaalFunnelStap(s)).toBe('aanbod');
  });

  it('afgevallen statussen geven null en tellen als afgevallen', () => {
    for (const st of ['niet_interessant', 'afgevallen', 'archief'] as OffMarketStatus[]) {
      const s = maakSignaal({ status: st });
      expect(bepaalFunnelStap(s)).toBeNull();
      expect(isAfgevallen(s)).toBe(true);
    }
  });

  it('gearchiveerd_op markeert als afgevallen ongeacht status', () => {
    const s = maakSignaal({ status: 'in_gesprek', gearchiveerd_op: '2025-06-10T00:00:00Z' });
    expect(bepaalFunnelStap(s)).toBeNull();
    expect(isAfgevallen(s)).toBe(true);
  });
});

describe('funnel-aggregaat & conversies', () => {
  it('telt highwater: een signaal in "in_gesprek" telt voor alle eerdere stappen', () => {
    const agg = berekenFunnelAggregaat([maakSignaal({ status: 'in_gesprek' })]);
    const inGesprek = agg.stappen.find(s => s.stage === 'in_gesprek')!;
    const reactie = agg.stappen.find(s => s.stage === 'reactie')!;
    const signaal = agg.stappen.find(s => s.stage === 'signaal')!;
    const aanbod = agg.stappen.find(s => s.stage === 'aanbod')!;
    expect(signaal.aantal).toBe(1);
    expect(reactie.aantal).toBe(1);
    expect(inGesprek.aantal).toBe(1);
    expect(aanbod.aantal).toBe(0);
  });

  it('conversie t.o.v. vorige en instroom kloppen', () => {
    const signalen: OffMarketSignaal[] = [
      maakSignaal({ status: 'nieuw_signaal' }),
      maakSignaal({ status: 'nieuw_signaal' }),
      maakSignaal({ status: 'interessant' }),
      maakSignaal({ status: 'te_onderzoeken' }),
      maakSignaal({ status: 'benaderd' }),
    ];
    const agg = berekenFunnelAggregaat(signalen);
    const map = Object.fromEntries(agg.stappen.map(s => [s.stage, s]));
    expect(map.signaal.aantal).toBe(5);
    expect(map.interessant.aantal).toBe(3);
    expect(map.te_onderzoeken.aantal).toBe(2);
    expect(map.benaderd.aantal).toBe(1);
    // Conversie interessant t.o.v. signaal = 3/5
    expect(map.interessant.conversiePrev).toBeCloseTo(3 / 5);
    expect(map.interessant.conversieInstroom).toBeCloseTo(3 / 5);
    // Conversie te_onderzoeken t.o.v. interessant = 2/3
    expect(map.te_onderzoeken.conversiePrev).toBeCloseTo(2 / 3);
    // Conversie benaderd t.o.v. instroom = 1/5
    expect(map.benaderd.conversieInstroom).toBeCloseTo(1 / 5);
  });

  it('afgevallen worden apart geteld en niet in stappen meegenomen', () => {
    const agg = berekenFunnelAggregaat([
      maakSignaal({ status: 'nieuw_signaal' }),
      maakSignaal({ status: 'niet_interessant' }),
      maakSignaal({ status: 'archief' }),
    ]);
    expect(agg.totaalActief).toBe(1);
    expect(agg.totaalAfgevallen).toBe(2);
    expect(agg.stappen.find(s => s.stage === 'signaal')!.aantal).toBe(1);
  });

  it('lege input geeft 0-aantallen en null-conversies (geen NaN)', () => {
    const agg = berekenFunnelAggregaat([]);
    expect(agg.totaalActief).toBe(0);
    expect(agg.totaalAfgevallen).toBe(0);
    for (const stap of agg.stappen) {
      expect(stap.aantal).toBe(0);
      if (stap.stage !== 'signaal') {
        expect(stap.conversiePrev).toBeNull();
        expect(stap.conversieInstroom).toBeNull();
      }
    }
  });
});

describe('drill-down helpers', () => {
  const signalen = [
    maakSignaal({ status: 'nieuw_signaal' }),
    maakSignaal({ status: 'interessant' }),
    maakSignaal({ status: 'in_gesprek' }),
    maakSignaal({ status: 'afgevallen' }),
  ];

  it('signalenOpStage levert alleen records met die exacte highwater', () => {
    expect(signalenOpStage(signalen, 'signaal')).toHaveLength(1);
    expect(signalenOpStage(signalen, 'interessant')).toHaveLength(1);
    expect(signalenOpStage(signalen, 'in_gesprek')).toHaveLength(1);
    expect(signalenOpStage(signalen, 'afgevallen')).toHaveLength(1);
  });

  it('signalenDieStageBereikten gebruikt highwater-cumulatie', () => {
    expect(signalenDieStageBereikten(signalen, 'signaal')).toHaveLength(3);
    expect(signalenDieStageBereikten(signalen, 'interessant')).toHaveLength(2);
    expect(signalenDieStageBereikten(signalen, 'in_gesprek')).toHaveLength(1);
    expect(signalenDieStageBereikten(signalen, 'aanbod')).toHaveLength(0);
  });
});

describe('filters', () => {
  const signalen = [
    maakSignaal({ plaats: 'Amsterdam', created_at: '2025-01-01T10:00:00Z' }),
    maakSignaal({ plaats: 'Utrecht', created_at: '2025-03-01T10:00:00Z' }),
    maakSignaal({ plaats: 'Rotterdam', created_at: '2025-06-01T10:00:00Z', status: 'interessant' }),
  ];

  it('periodefilter werkt op created_at', () => {
    const r = filterSignalen(signalen, { periodeVan: '2025-02-01', periodeTot: '2025-05-01' });
    expect(r).toHaveLength(1);
    expect(r[0].plaats).toBe('Utrecht');
  });

  it('tot-datum is inclusief — record op exacte tot-datum blijft zichtbaar', () => {
    // Record gemaakt op 13-06-2026 om 14:30 lokaal (na UTC middernacht, voor einde dag).
    const r = [maakSignaal({
      plaats: 'Den Haag',
      created_at: new Date(2026, 5, 13, 14, 30).toISOString(),
    })];
    expect(filterSignalen(r, { periodeVan: '2026-06-13', periodeTot: '2026-06-13' })).toHaveLength(1);
    expect(filterSignalen(r, { periodeVan: '2026-06-11', periodeTot: '2026-06-13' })).toHaveLength(1);
  });

  it('ruimere range bevat altijd minimaal de records van een smallere range erbinnen', () => {
    const r = [
      maakSignaal({ created_at: new Date(2026, 5, 11, 9, 0).toISOString() }),
      maakSignaal({ created_at: new Date(2026, 5, 12, 23, 0).toISOString() }),
      maakSignaal({ created_at: new Date(2026, 5, 13, 14, 30).toISOString() }),
    ];
    const smal = filterSignalen(r, { periodeVan: '2026-06-13', periodeTot: '2026-06-13' });
    const ruim = filterSignalen(r, { periodeVan: '2026-06-11', periodeTot: '2026-06-13' });
    expect(smal.length).toBe(1);
    expect(ruim.length).toBe(3);
    expect(ruim.length).toBeGreaterThanOrEqual(smal.length);
  });

  it('accepteert ook dd-mm-yyyy datumnotatie', () => {
    const r = [maakSignaal({ created_at: new Date(2026, 5, 13, 12, 0).toISOString() })];
    expect(filterSignalen(r, { periodeVan: '13-06-2026', periodeTot: '13-06-2026' })).toHaveLength(1);
  });

  it('gemeentefilter is case-insensitive contains', () => {
    expect(filterSignalen(signalen, { gemeente: 'amst' })).toHaveLength(1);
    expect(filterSignalen(signalen, { gemeente: 'rotter' })[0].plaats).toBe('Rotterdam');
  });

  it('statusfilter werkt', () => {
    const r = filterSignalen(signalen, { status: 'interessant' });
    expect(r).toHaveLength(1);
  });

  it('bron off_market_radar matcht alle off-market signalen (V1)', () => {
    expect(filterSignalen(signalen, { bron: 'off_market_radar' })).toHaveLength(3);
    expect(filterSignalen(signalen, { bron: 'facebook_ads' })).toHaveLength(0);
  });
});

describe('archief-mapping', () => {
  it('signaal met gearchiveerd_op valt onder afgevallen, ook als status nog "in_gesprek" is', () => {
    const s = maakSignaal({ status: 'in_gesprek', gearchiveerd_op: '2026-06-12T10:00:00Z' });
    expect(isAfgevallen(s)).toBe(true);
    expect(bepaalFunnelStap(s)).toBeNull();
    const agg = berekenFunnelAggregaat([s]);
    expect(agg.totaalAfgevallen).toBe(1);
    expect(agg.totaalActief).toBe(0);
  });

  it('signaal met status "archief" (zoals gezet door OffMarketArchiveDialog) telt als afgevallen', () => {
    const s = maakSignaal({ status: 'archief', gearchiveerd_op: '2026-06-12T10:00:00Z' });
    const agg = berekenFunnelAggregaat([s]);
    expect(agg.totaalAfgevallen).toBe(1);
    expect(signalenOpStage([s], 'afgevallen')).toHaveLength(1);
  });
});

describe('bron-aggregaat', () => {
  it('groepeert Off-Market signalen onder off_market_radar', () => {
    const r = berekenBronAggregaat([
      maakSignaal({ status: 'nieuw_signaal' }),
      maakSignaal({ status: 'benaderd' }),
      maakSignaal({ status: 'afgevallen' }), // niet meegerekend
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].bron).toBe('off_market_radar');
    expect(r[0].totaal).toBe(2);
    expect(r[0].perStage.signaal).toBe(2);
    expect(r[0].perStage.benaderd).toBe(1);
  });
});

describe('stageRank consistency', () => {
  it('FUNNEL_STAGES heeft 11 stages in correcte volgorde', () => {
    expect(FUNNEL_STAGES).toHaveLength(11);
    expect(stageRank('signaal')).toBe(0);
    expect(stageRank('transactie')).toBe(10);
    expect(stageRank('reactie')).toBeLessThan(stageRank('in_gesprek'));
    expect(stageRank('in_gesprek')).toBeLessThan(stageRank('aanbod'));
  });
});
