import { describe, expect, it } from 'vitest';
import { KANDIDAAT_NAAR_OBJECT_STAGE, PIPELINE_FASES } from '@/data/mock-data';
import type { Bieding } from './types';
import {
  counterStatusForDirection,
  getNegotiationPositions,
  getOfferProgressTarget,
  nextCounterDirection,
  shouldAdvanceCandidate,
} from './progression';

const offer = (patch: Partial<Bieding> = {}): Bieding => ({
  id: 'b1', objectId: 'o1', relatieId: 'r1', bedrag: 600000,
  currency: 'EUR', bieddatum: '2026-09-01', status: 'ontvangen',
  offerType: 'indicatief', financieringsvoorbehoud: 'onbekend', ddVoorbehoud: 'onbekend',
  richting: 'van_koper', isBestOffer: false, isFinalOffer: false,
  createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  ...patch,
});

describe('bieding -> kandidaat -> object voortgang', () => {
  it('zet een eerste koperprijsvoorstel op biedingsniveau, niet automatisch op onderhandeling', () => {
    expect(getOfferProgressTarget(offer())).toBe('indicatieve_bieding');
    expect(PIPELINE_FASES.find(f => f.key === 'indicatieve_bieding')?.label).toBe('Bieding / prijsvoorstel');
  });

  it('zet een echte tegenvoorstelreeks op onderhandeling', () => {
    expect(getOfferProgressTarget(offer({ richting: 'van_verkoper', offerType: 'tegenvoorstel', status: 'tegenvoorstel_gedaan', counterOfferToId: 'b0' }))).toBe('onderhandeling');
    expect(getOfferProgressTarget(offer({ offerType: 'verhoogd_bod', counterOfferToId: 'b0' }))).toBe('onderhandeling');
  });

  it('laat een individuele kandidaat het Object nooit afsluiten', () => {
    expect(KANDIDAAT_NAAR_OBJECT_STAGE.afgevallen).toBeUndefined();
    expect(KANDIDAAT_NAAR_OBJECT_STAGE.afgerond).toBeUndefined();
  });

  it('kan een afgevallen kandidaat door nieuw concreet gedrag reactiveren, maar een afgeronde niet terugzetten', () => {
    expect(shouldAdvanceCandidate('afgevallen', 'indicatieve_bieding')).toBe(true);
    expect(shouldAdvanceCandidate('afgerond', 'onderhandeling')).toBe(false);
  });
});

describe('tegenvoorstellen', () => {
  it('wisselt de richting koper -> verkoper -> koper', () => {
    expect(nextCounterDirection('van_koper')).toBe('van_verkoper');
    expect(nextCounterDirection('van_verkoper')).toBe('van_koper');
    expect(counterStatusForDirection('van_koper')).toBe('ontvangen');
    expect(counterStatusForDirection('van_verkoper')).toBe('tegenvoorstel_gedaan');
  });

  it('bewaart laatste koper- en verkoperspositie als één onderhandelingstraject', () => {
    const items = [
      offer({ id: 'b1', bedrag: 600000, richting: 'van_koper', createdAt: '2026-09-01T10:00:00Z' }),
      offer({ id: 'b2', bedrag: 800000, richting: 'van_verkoper', offerType: 'tegenvoorstel', status: 'tegenvoorstel_gedaan', counterOfferToId: 'b1', createdAt: '2026-09-01T11:00:00Z' }),
      offer({ id: 'b3', bedrag: 700000, richting: 'van_koper', offerType: 'tegenvoorstel', counterOfferToId: 'b2', createdAt: '2026-09-01T12:00:00Z' }),
    ];
    const [p] = getNegotiationPositions(items);
    expect(p.latestBuyer?.bedrag).toBe(700000);
    expect(p.latestSeller?.bedrag).toBe(800000);
    expect(p.gap).toBe(100000);
  });
});
