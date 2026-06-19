// V2.3 — Trigger-helpers: AI-fan-out na create + BAG-fan-out na AI.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAiAutoVerrijking, triggerBagAutoNaAi } from '@/lib/offMarket/bag/triggers';

const invokeMock = vi.fn();
const maybeSingleMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingleMock() }) }),
      update: (patch: unknown) => ({ eq: async () => updateMock(patch) }),
    }),
  },
}));

describe('triggerAiAutoVerrijking', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('triggert AI bij geschikt nieuw signaal', () => {
    triggerAiAutoVerrijking({
      id: 's1', titel: 'Pand', plaats: 'Stad', adres: 'Straat 1', postcode: '1000AA',
      ai_status: 'niet_verrijkt',
    });
    expect(invokeMock).toHaveBeenCalledWith('off-market-enrich-signaal', expect.objectContaining({
      body: { signaal_id: 's1', force: false },
    }));
  });

  it('triggert NIET bij ai_status=bezig (race condition)', () => {
    triggerAiAutoVerrijking({
      id: 's1', titel: 'Pand', plaats: 'Stad', ai_status: 'bezig',
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('triggert NIET bij gearchiveerd signaal', () => {
    triggerAiAutoVerrijking({
      id: 's1', titel: 'Pand', plaats: 'Stad', ai_status: 'niet_verrijkt',
      gearchiveerd_op: '2026-01-01',
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('triggerBagAutoNaAi', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockReset();
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    updateMock.mockResolvedValue({ data: null, error: null });
  });

  it('triggert BAG en persisteert advies bij ai_score >= 70', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: {
          id: 's1', ai_status: 'klaar', ai_score: 80,
          bag_status: 'niet_verrijkt',
          adres: 'Straat 12', postcode: '1000AA', plaats: 'Stad',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 's1', ai_status: 'klaar', ai_score: 80,
          bag_status: 'verrijkt', bag_aantal_vbo: 2, bag_totaal_oppervlakte_m2: 220,
          bag_match_kwaliteit: 'exact',
        },
        error: null,
      });

    await triggerBagAutoNaAi('s1');

    expect(invokeMock).toHaveBeenCalledWith('off-market-bag-verrijk', expect.anything());
    expect(updateMock).toHaveBeenCalled();
  });

  it('triggert NIET bij ai_score < 50', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 's1', ai_status: 'klaar', ai_score: 40,
        bag_status: 'niet_verrijkt',
        adres: 'Straat 12', postcode: '1000AA', plaats: 'Stad',
      },
      error: null,
    });
    await triggerBagAutoNaAi('s1');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('triggert NIET bij slechte adreskwaliteit', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 's1', ai_status: 'klaar', ai_score: 90,
        bag_status: 'niet_verrijkt',
        adres: null, postcode: null, plaats: null,
      },
      error: null,
    });
    await triggerBagAutoNaAi('s1');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('roept nooit Kadaster-edge-function aan', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 's1', ai_status: 'klaar', ai_score: 80,
        bag_status: 'niet_verrijkt',
        adres: 'Straat 12', postcode: '1000AA', plaats: 'Stad',
      },
      error: null,
    });
    await triggerBagAutoNaAi('s1');
    const fnNames = invokeMock.mock.calls.map((c) => c[0]);
    expect(fnNames).not.toContain('kadaster-objectinformatie');
  });
});
