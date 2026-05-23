import { describe, it, expect } from 'vitest';
import {
  selectLeadDeal,
  calculateExpectedFee,
  countKandidaten,
  isActiveDealFase,
} from '@/lib/derivations/deal';
import type { Deal, MatchResult, PipelineKandidaat } from '@/data/mock-data';

const baseDeal = (over: Partial<Deal>): Deal => ({
  id: over.id ?? 'd1',
  objectId: over.objectId ?? 'obj1',
  relatieId: over.relatieId ?? 'r1',
  fase: over.fase ?? 'interesse',
  interessegraad: 3,
  datumEersteContact: over.datumEersteContact ?? '2026-01-01',
  ...over,
});

describe('deal — selectLeadDeal', () => {
  it('kiest hoogste fasekans onder actieve deals', () => {
    const deals: Deal[] = [
      baseDeal({ id: 'a', fase: 'lead' }),
      baseDeal({ id: 'b', fase: 'bieding' }),
      baseDeal({ id: 'c', fase: 'introductie' }),
    ];
    expect(selectLeadDeal(deals, 'obj1')?.id).toBe('b');
  });

  it('valt terug op meest recente niet-actieve deal als geen actieve bestaat', () => {
    const deals: Deal[] = [
      baseDeal({ id: 'a', fase: 'afgevallen', datumEersteContact: '2025-01-01' }),
      baseDeal({ id: 'b', fase: 'afgerond', datumEersteContact: '2025-06-01' }),
    ];
    expect(selectLeadDeal(deals, 'obj1')?.id).toBe('b');
  });

  it('returnt null voor onbekend objectId', () => {
    expect(selectLeadDeal([baseDeal({})], 'andere')).toBeNull();
    expect(selectLeadDeal(null, 'x')).toBeNull();
  });

  it('isActiveDealFase: afgerond/afgevallen = false, rest = true', () => {
    expect(isActiveDealFase('afgerond')).toBe(false);
    expect(isActiveDealFase('afgevallen')).toBe(false);
    expect(isActiveDealFase('interesse')).toBe(true);
  });
});

describe('deal — calculateExpectedFee', () => {
  it('sommeert commissieBedrag × FASE_KANS over actieve deals', () => {
    // bieding = 0.55, interesse = 0.20
    const deals: Deal[] = [
      baseDeal({ id: 'a', fase: 'bieding', commissieBedrag: 10000 }),  // 5500
      baseDeal({ id: 'b', fase: 'interesse', commissieBedrag: 5000 }), // 1000
      baseDeal({ id: 'c', fase: 'afgevallen', commissieBedrag: 99999 }), // 0
    ];
    expect(calculateExpectedFee(deals)).toBeCloseTo(6500, 4);
  });

  it('lege/null input geeft 0', () => {
    expect(calculateExpectedFee(null)).toBe(0);
    expect(calculateExpectedFee([])).toBe(0);
  });
});

describe('deal — countKandidaten', () => {
  const mkPipeline = (over: Partial<PipelineKandidaat>): PipelineKandidaat => ({
    id: over.id ?? 'p1',
    objectId: over.objectId ?? 'obj1',
    relatieId: over.relatieId ?? 'r1',
    pipelineFase: over.pipelineFase ?? 'interesse',
    interesseNiveau: 'gemiddeld',
    teaserVerstuurd: false,
    ndaVerstuurd: false,
    ndaGetekend: false,
    informatieGedeeld: false,
    feeAkkoord: false,
    ...over,
  });

  const mkMatch = (relatieId: string, score: number, objectId = 'obj1'): MatchResult => ({
    objectId,
    relatieId,
    zoekprofielId: `zp-${relatieId}`,
    score,
    factoren: [],
    redenen: [],
    mismatches: [],
    ontbrekendeData: [],
    kernIngevuld: 0,
    globaleMatch: 'goed',
  } as unknown as MatchResult);

  it('telt unieke relaties uit pipeline én sterke matches', () => {
    const result = countKandidaten({
      objectId: 'obj1',
      pipelineRows: [mkPipeline({ relatieId: 'r1' }), mkPipeline({ id: 'p2', relatieId: 'r2' })],
      matches: [mkMatch('r3', 80), mkMatch('r4', 50) /* niet sterk */],
    });
    expect(result.total).toBe(3);
    expect(result.fromPipeline).toBe(2);
    expect(result.fromMatches).toBe(1);
    expect(new Set(result.uniekeRelaties)).toEqual(new Set(['r1', 'r2', 'r3']));
  });

  it('dedupliceert: zelfde relatie in pipeline én match telt 1×', () => {
    const result = countKandidaten({
      objectId: 'obj1',
      pipelineRows: [mkPipeline({ relatieId: 'r1' })],
      matches: [mkMatch('r1', 90)],
    });
    expect(result.total).toBe(1);
    expect(result.fromPipeline).toBe(1);
    expect(result.fromMatches).toBe(1);
  });

  it('respecteert STRONG_MATCH_THRESHOLD=70', () => {
    const result = countKandidaten({
      objectId: 'obj1',
      matches: [mkMatch('r1', 69), mkMatch('r2', 70), mkMatch('r3', 85)],
    });
    expect(result.fromMatches).toBe(2);
  });

  it('filtert matches op objectId', () => {
    const result = countKandidaten({
      objectId: 'obj1',
      matches: [mkMatch('r1', 90, 'obj1'), mkMatch('r2', 90, 'obj2')],
    });
    expect(result.fromMatches).toBe(1);
  });
});
