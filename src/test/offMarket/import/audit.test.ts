import { describe, it, expect } from 'vitest';
import {
  mapRuwNaarGeskipt,
  filterGeskipt,
  buildHandmatigePromotie,
  type GeskiptRecord,
} from '@/lib/offMarket/import/audit';

const baseRij = {
  id: 'r1',
  bron_id: 'b-ams',
  extern_id: 'gmb-1',
  binnengekomen_op: '2026-06-05T10:00:00Z',
  updated_at: '2026-06-05T11:00:00Z',
  signaal_id: null,
};

function maakRij(overrides: Partial<{ payload: Record<string, unknown> }> = {}) {
  return {
    ...baseRij,
    payload: {
      titel: 'Aanvraag omgevingsvergunning Vondelstraat 70',
      samenvatting: 'plaatsen dakkapel',
      datum: '2026-06-01',
      link: 'https://zoek.officielebekendmakingen.nl/gmb-1.html',
      subjects: ['omgevingsvergunning'],
      score: 30,
      skip_reden: 'score=30 (drempel=40)',
      score_componenten: [
        { label: 'adres', delta: 20 },
        { label: 'assettype:overig', delta: 0 },
        { label: 'onderhoud/ruis (dakkapel)', delta: -40 },
      ],
      score_componenten_tekst: '+20 adres · -40 onderhoud/ruis (dakkapel)',
      ...overrides.payload,
    },
  };
}

describe('mapRuwNaarGeskipt', () => {
  it('mapt payload-velden + componenten', () => {
    const g = mapRuwNaarGeskipt(maakRij());
    expect(g.titel).toContain('Vondelstraat');
    expect(g.score).toBe(30);
    expect(g.skip_reden).toContain('score=30');
    expect(g.score_componenten).toHaveLength(3);
    expect(g.score_componenten_tekst).toContain('+20 adres');
    expect(g.handmatig_genegeerd).toBe(false);
  });

  it('genereert score_componenten_tekst als die ontbreekt maar componenten er wel zijn', () => {
    const g = mapRuwNaarGeskipt(maakRij({
      payload: { score_componenten_tekst: undefined },
    }));
    expect(g.score_componenten_tekst).toMatch(/\+20 adres/);
  });

  it('herkent handmatig_genegeerd-vlag', () => {
    const g = mapRuwNaarGeskipt(maakRij({ payload: { handmatig_genegeerd: true } }));
    expect(g.handmatig_genegeerd).toBe(true);
  });

  it('handelt lege payload veilig af', () => {
    const g = mapRuwNaarGeskipt({ ...baseRij, payload: null });
    expect(g.score).toBe(0);
    expect(g.titel).toBe('(geen titel)');
    expect(g.score_componenten_tekst).toBeNull();
  });
});

function maakGeskipt(p: Partial<GeskiptRecord>): GeskiptRecord {
  return {
    id: p.id ?? 'r',
    bron_id: p.bron_id ?? 'b-ams',
    extern_id: 'gmb-x',
    binnengekomen_op: '2026-06-05T10:00:00Z',
    updated_at: '2026-06-05T11:00:00Z',
    signaal_id: p.signaal_id ?? null,
    titel: p.titel ?? 'Titel',
    samenvatting: p.samenvatting ?? '',
    datum: p.datum ?? '2026-06-01',
    link: null,
    subjects: ['omgevingsvergunning'],
    score: p.score ?? 30,
    skip_reden: 'score',
    score_componenten: [],
    score_componenten_tekst: null,
    handmatig_genegeerd: p.handmatig_genegeerd ?? false,
    payload: {},
  };
}

describe('filterGeskipt', () => {
  const records: GeskiptRecord[] = [
    maakGeskipt({ id: '1', bron_id: 'b-ams', score: 0, titel: 'Dakkapel' }),
    maakGeskipt({ id: '2', bron_id: 'b-ams', score: 30, titel: 'Vondelstraat kamerverhuur' }),
    maakGeskipt({ id: '3', bron_id: 'b-rdam', score: 50, titel: 'Transformatie' }),
    maakGeskipt({ id: '4', bron_id: 'b-ams', score: 35, titel: 'Onttrekking', handmatig_genegeerd: true }),
  ];

  it('filtert standaard verborgen records weg', () => {
    expect(filterGeskipt(records, {}).map(r => r.id)).toEqual(['1', '2', '3']);
  });

  it('filtert op bron', () => {
    expect(filterGeskipt(records, { bronId: 'b-ams' }).map(r => r.id)).toEqual(['1', '2']);
  });

  it('filtert op score-range', () => {
    expect(filterGeskipt(records, { minScore: 20, maxScore: 40 }).map(r => r.id)).toEqual(['2']);
  });

  it('twijfelmodus dwingt range 25–39 af', () => {
    expect(filterGeskipt(records, { alleenTwijfel: true }).map(r => r.id)).toEqual(['2']);
  });

  it('zoekterm matcht in titel', () => {
    expect(filterGeskipt(records, { zoekterm: 'kamerverhuur' }).map(r => r.id)).toEqual(['2']);
  });

  it('toonGenegeerd haalt verborgen weer naar voren', () => {
    expect(filterGeskipt(records, { toonGenegeerd: true }).map(r => r.id))
      .toEqual(['1', '2', '3', '4']);
  });

  it('vanafDatum filtert op record-datum', () => {
    const r = filterGeskipt(records, { vanafDatum: '2026-06-15' });
    expect(r).toHaveLength(0);
  });
});

describe('buildHandmatigePromotie', () => {
  it('bouwt insert-payload met handmatige-promotie-notitie', async () => {
    const g = mapRuwNaarGeskipt(maakRij({
      payload: {
        titel: 'Aanvraag onttrekkingsvergunning Rustenburgerstraat 140D',
        samenvatting: 'onttrekken woonruimte naar kamerverhuur',
        score: 30,
        skip_reden: 'score=30 (drempel=40)',
        score_componenten_tekst: '+20 adres',
      },
    }));
    const { insertPayload, ruwUpdatePayload } = await buildHandmatigePromotie(g, {
      gemeente: 'Amsterdam', provincie: 'Noord-Holland',
    });
    expect(insertPayload.plaats).toBe('Amsterdam');
    expect(insertPayload.provincie).toBe('Noord-Holland');
    expect(insertPayload.status).toBe('nieuw_signaal');
    expect(insertPayload.prioriteit).toBe('laag');
    expect(insertPayload.ai_status).toBe('niet_verrijkt');
    expect(insertPayload.adres).toBe('Rustenburgerstraat 140D');
    expect(insertPayload.dedupe_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(insertPayload.notities).toContain('handmatig gepromoveerd');
    expect(insertPayload.notities).toContain('score=30');
    expect(insertPayload.notities).toContain('+20 adres');
    expect(ruwUpdatePayload.handmatig_gepromoveerd).toBe(true);
  });

  it('weigert dubbele promotie', async () => {
    const g = mapRuwNaarGeskipt(maakRij());
    g.signaal_id = 'bestaand-signaal-id';
    await expect(
      buildHandmatigePromotie(g, { gemeente: 'Amsterdam' }),
    ).rejects.toThrow(/al gepromoveerd/i);
  });
});
