import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

/**
 * Test de classificatie binnen invokeBagSignaal:
 *  - actuele guard vlak vóór invoke (overgeslagen);
 *  - response.status → kind;
 *  - error of {ok:false} → fout;
 *  - geen/ongeldig statusveld → refetch bag_status;
 *  - meerdere_matches telt NIET als fout;
 *  - alleen 'off-market-bag-verrijk' wordt aangeroepen.
 */

type GuardRow = SignaalBagInput;

interface State {
  guardRow: GuardRow | null;
  invokeResp: { data?: unknown; error?: unknown };
  bagStatusRow: { bag_status?: string | null } | null;
}

const state: State = {
  guardRow: null,
  invokeResp: { data: { ok: true, status: 'verrijkt' }, error: null },
  bagStatusRow: null,
};

const invokeAanroepen: Array<{ naam: string; body: any }> = [];
const invokeMock = vi.fn(async (naam: string, opts: any) => {
  invokeAanroepen.push({ naam, body: opts?.body });
  return state.invokeResp;
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (_table: string) => ({
      select: (cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => {
            // Alleen bag_status-projectie → refetch-pad.
            if (cols.trim() === 'bag_status') {
              return { data: state.bagStatusRow, error: null };
            }
            return { data: state.guardRow, error: null };
          },
        }),
      }),
    }),
    functions: { invoke: invokeMock },
  },
}));

const geschikt: GuardRow = {
  id: 'sig-1',
  titel: 'Generiek pand',
  adres: 'Teststraat 12',
  postcode: '1234AB',
  plaats: 'Testplaats',
  bron_url: 'https://example.test/x',
  ai_status: 'klaar',
  ai_score: 80,
  ai_skip_reden: null,
  bag_status: 'niet_verrijkt',
};

beforeEach(() => {
  state.guardRow = { ...geschikt };
  state.invokeResp = { data: { ok: true, status: 'verrijkt' }, error: null };
  state.bagStatusRow = null;
  invokeAanroepen.length = 0;
  invokeMock.mockClear();
});

async function loadInvoke() {
  return (await import('@/hooks/useBagBacklog')).invokeBagSignaal;
}

describe('invokeBagSignaal — classificatie', () => {
  it('overgeslagen wanneer actuele guard weigert (geen invoke)', async () => {
    state.guardRow = { ...geschikt, bag_status: 'verrijkt' };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('overgeslagen');
    expect(invokeAanroepen).toHaveLength(0);
  });

  it('response.status="verrijkt" → verrijkt', async () => {
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('verrijkt');
    expect(invokeAanroepen).toHaveLength(1);
    expect(invokeAanroepen[0].naam).toBe('off-market-bag-verrijk');
    expect(invokeAanroepen[0].body).toEqual({ signaal_id: 'sig-1', force: false });
  });

  it('response.status="meerdere_matches" → meerdere_matches (geen fout)', async () => {
    state.invokeResp = {
      data: { ok: true, status: 'meerdere_matches' },
      error: null,
    };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('meerdere_matches');
  });

  it('response.status="geen_match" → geen_match', async () => {
    state.invokeResp = { data: { ok: true, status: 'geen_match' }, error: null };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('geen_match');
  });

  it('response.status="fout" → fout', async () => {
    state.invokeResp = {
      data: { ok: true, status: 'fout', error: 'parser' },
      error: null,
    };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('fout');
  });

  it('error op invoke → fout (non-2xx telt als fout, geen retry)', async () => {
    state.invokeResp = { data: null, error: { message: 'http 500' } };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('fout');
    expect(r.error).toBe('http 500');
  });

  it('data.ok=false zonder status → fout', async () => {
    state.invokeResp = { data: { ok: false, error: 'mis' }, error: null };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('fout');
    expect(r.error).toBe('mis');
  });

  it('status="bezig" → refetcht bag_status uit DB', async () => {
    state.invokeResp = { data: { ok: true, status: 'bezig' }, error: null };
    state.bagStatusRow = { bag_status: 'verrijkt' };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('verrijkt');
  });

  it('ontbrekend statusveld → refetcht; onbekende waarde → fout', async () => {
    state.invokeResp = { data: { ok: true }, error: null };
    state.bagStatusRow = { bag_status: 'iets_geks' };
    const invoke = await loadInvoke();
    const r = await invoke('sig-1');
    expect(r.kind).toBe('fout');
  });
});
