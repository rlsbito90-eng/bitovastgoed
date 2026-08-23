import { describe, expect, it } from 'vitest';
import { bouwAcquisitieConversieDashboard } from '@/lib/acquisitie/conversieDashboard';

const event = (overrides: Record<string, unknown> = {}) => ({
  occurred_at: '2026-07-01T10:00:00Z',
  acquisitie_bron: 'off_market_radar',
  event_type: 'communicatie_verzonden',
  brief_id: 'b1',
  kanaal: 'post',
  telt_verzonden_communicatie: true,
  telt_reactie: false,
  telt_positieve_reactie: false,
  ...overrides,
});

describe('acquisitie conversiedashboard', () => {
  it('rekent een reactie toe aan het kanaal van de oorspronkelijke verzending', () => {
    const model = bouwAcquisitieConversieDashboard([
      event(),
      event({
        occurred_at: '2026-07-09T10:00:00Z',
        event_type: 'reactie_ontvangen',
        kanaal: 'whatsapp',
        telt_verzonden_communicatie: false,
        telt_reactie: true,
        telt_positieve_reactie: true,
      }),
    ], [{ id: 'b1', campagne_stap: 'brief_1' }], 2026);

    expect(model.totaal).toMatchObject({ verzonden: 1, reacties: 1, positieveReacties: 1, responspercentage: 100 });
    expect(model.perKanaal).toHaveLength(1);
    expect(model.perKanaal[0]).toMatchObject({ sleutel: 'post', reacties: 1, responspercentage: 100 });
    expect(model.perTouchpoint[0]).toMatchObject({ sleutel: 'brief_1', reacties: 1 });
  });

  it('houdt latere reacties bij het verzendcohort', () => {
    const model = bouwAcquisitieConversieDashboard([
      event({ occurred_at: '2026-06-30T22:00:00Z' }),
      event({
        occurred_at: '2026-08-10T10:00:00Z',
        event_type: 'reactie_ontvangen',
        telt_verzonden_communicatie: false,
        telt_reactie: true,
      }),
    ], [{ id: 'b1', campagne_stap: 'brief_1' }], 2026);

    expect(model.perMaand).toHaveLength(1);
    expect(model.perMaand[0].sleutel).toBe('2026-06');
    expect(model.perMaand[0].reacties).toBe(1);
  });

  it('groepeert gelabelde communicatie centraal per tekstvariant', () => {
    const model = bouwAcquisitieConversieDashboard([
      event(),
      event({ occurred_at: '2026-07-05T10:00:00Z', event_type: 'reactie_ontvangen', telt_verzonden_communicatie: false, telt_reactie: true }),
    ], [{
      id: 'b1', campagne_stap: 'brief_1', copy_profiel: 'woonvorming',
      copy_variant_key: 'woonvorming:post:brief_1:A', copy_variant_code: 'A',
    }], 2026);

    expect(model.perVariant).toHaveLength(1);
    expect(model.perVariant[0]).toMatchObject({ verzonden: 1, reacties: 1, responspercentage: 100 });
    expect(model.variantGelabeld).toBe(1);
    expect(model.variantOngelabeld).toBe(0);
  });

  it('neemt verzendingen buiten het gekozen jaar niet mee', () => {
    const model = bouwAcquisitieConversieDashboard([
      event({ occurred_at: '2025-12-20T10:00:00Z' }),
    ], [{ id: 'b1', campagne_stap: 'brief_1' }], 2026);

    expect(model.totaal.verzonden).toBe(0);
  });
});
