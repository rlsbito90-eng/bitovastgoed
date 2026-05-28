// Golden regressie-tests voor computeScenario.
//
// Doel: per casustype invariants verifiëren zodat stille drift in
// rekenlogica direct opvalt. Test geen vaste eindbedragen — die zijn
// te broos — maar rekenkundige identiteiten en bandbreedtes per fixture.

import { describe, it, expect } from 'vitest';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { detectCaseType, getCaseRequirement } from '@/lib/vastgoedrekenen/validation/caseRequirements';
import { buildCalcChain } from '@/lib/vastgoedrekenen/audit/calcChain';
import { GOLDEN_FIXTURES } from './fixtures';

describe('computeScenario — golden fixtures', () => {
  for (const fx of GOLDEN_FIXTURES) {
    describe(fx.name, () => {
      const o = computeScenario(fx.ctx);

      it('produceert positieve of nulwaarden waar verwacht', () => {
        if (fx.expects.investmentPositive) expect(o.totalInvestment).toBeGreaterThan(0);
        expect(o.maximumBid).toBeGreaterThanOrEqual(0);
        expect(o.maximumAllInValue).toBeGreaterThanOrEqual(0);
      });

      it('eerbiedigt rekenkundige identiteit totalInvestment ≈ purchase + ovb + acq + costs + financing', () => {
        const p = Number(fx.ctx.scenario.purchase_price ?? 0);
        const fin = Number((fx.ctx.scenario as unknown as Record<string, unknown>).financing_costs ?? 0);
        const sum = p + o.totalTransferTax + o.totalAcquisitionCosts + o.totalCosts + fin;
        expect(Math.abs(o.totalInvestment - sum)).toBeLessThan(2);
      });

      it('respecteert bidBasis-keuze', () => {
        if (fx.expects.bidBasis) expect(o.bidBasisUsed).toBe(fx.expects.bidBasis);
      });

      it('houdt maximumBid binnen verwachte bandbreedte', () => {
        if (fx.expects.maxBidMin != null) expect(o.maximumBid).toBeGreaterThanOrEqual(fx.expects.maxBidMin);
        if (fx.expects.maxBidMax != null) expect(o.maximumBid).toBeLessThanOrEqual(fx.expects.maxBidMax);
      });

      it('detecteert een casustype', () => {
        const type = detectCaseType(fx.ctx.scenario, fx.ctx.components, fx.ctx.strategyUnits ?? [], fx.ctx.objectType);
        expect(type).not.toBe('onbekend');
        const req = getCaseRequirement(type);
        expect(req.label.length).toBeGreaterThan(0);
      });

      it('bouwt een rekenketen zonder runtime-fouten', () => {
        const chain = buildCalcChain(fx.ctx.scenario, o);
        expect(chain.length).toBeGreaterThan(5);
        // Elke fase moet ten minste één regel bevatten (behalve optionele opbrengst/netto bij pure hold)
        const fases = new Set(chain.map((s) => s.fase));
        expect(fases.has('input')).toBe(true);
        expect(fases.has('investering')).toBe(true);
        expect(fases.has('max_bod')).toBe(true);
        expect(fases.has('vergelijking')).toBe(true);
      });

      it('verschil met vraagprijs = maximumBid − vraagprijs', () => {
        const asking = Number(fx.ctx.scenario.asking_price ?? 0);
        if (asking > 0) {
          expect(Math.abs(o.differenceWithAskingPrice - (o.maximumBid - asking))).toBeLessThan(2);
        }
      });
    });
  }
});
