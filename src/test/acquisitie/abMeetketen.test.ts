import { describe, expect, it } from 'vitest';
import { bouwAcquisitieConversieDashboard } from '@/lib/acquisitie/conversieDashboard';

const verzending = (briefId: string, overrides: Record<string, unknown> = {}) => ({
  occurred_at: '2026-08-23T09:00:00Z',
  acquisitie_bron: 'off_market_radar',
  event_type: 'communicatie_verzonden',
  brief_id: briefId,
  kanaal: 'post',
  telt_verzonden_communicatie: true,
  telt_reactie: false,
  telt_positieve_reactie: false,
  ...overrides,
});

describe('A/B meetketen acquisitie', () => {
  it('rekent een inkomende reactie exact toe aan de verzonden B-variant', () => {
    const model = bouwAcquisitieConversieDashboard([
      verzending('brief-a'),
      verzending('brief-b', { occurred_at: '2026-08-23T09:05:00Z' }),
      verzending('brief-b', {
        occurred_at: '2026-08-28T10:00:00Z',
        event_type: 'reactie_ontvangen',
        kanaal: 'whatsapp',
        telt_verzonden_communicatie: false,
        telt_reactie: true,
        telt_positieve_reactie: true,
      }),
    ], [
      {
        id: 'brief-a',
        campagne_stap: 'brief_1',
        copy_profiel: 'splitsingspotentie',
        copy_variant_key: 'splitsingspotentie:post:brief_1:A',
        copy_variant_code: 'A',
      },
      {
        id: 'brief-b',
        campagne_stap: 'brief_1',
        copy_profiel: 'splitsingspotentie',
        copy_variant_key: 'splitsingspotentie:post:brief_1:B',
        copy_variant_code: 'B',
      },
    ], 2026, new Date('2026-08-30T12:00:00Z'));

    const a = model.perVariant.find(rij => rij.sleutel.endsWith(':A'));
    const b = model.perVariant.find(rij => rij.sleutel.endsWith(':B'));

    expect(a).toMatchObject({ verzonden: 1, reacties: 0, positieveReacties: 0 });
    expect(b).toMatchObject({ verzonden: 1, reacties: 1, positieveReacties: 1, responspercentage: 100 });
    expect(model.perKanaal).toHaveLength(1);
    expect(model.perKanaal[0]).toMatchObject({ sleutel: 'post', verzonden: 2, reacties: 1 });
    expect(model.reactiesZonderVerzending).toBe(0);
  });

  it('dedupliceert dubbele verzendevents op dezelfde brief', () => {
    const model = bouwAcquisitieConversieDashboard([
      verzending('brief-a'),
      verzending('brief-a', { occurred_at: '2026-08-23T09:01:00Z' }),
    ], [{
      id: 'brief-a',
      campagne_stap: 'brief_1',
      copy_profiel: 'splitsingspotentie',
      copy_variant_key: 'splitsingspotentie:post:brief_1:A',
      copy_variant_code: 'A',
    }], 2026);

    expect(model.totaal.verzonden).toBe(1);
    expect(model.perVariant[0].verzonden).toBe(1);
  });
});
