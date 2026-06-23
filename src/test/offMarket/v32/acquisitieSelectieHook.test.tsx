// V32 — Acquisitieselectie-hook: voegt toe, dedupliceert, soft-removed, heractiveert.
// Volledig in-memory mock op de Supabase-client; geen netwerk-calls.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── In-memory mock-tabel ────────────────────────────────────────────────────
interface Rij {
  id: string;
  signaal_id: string;
  toegevoegd_door: string | null;
  toegevoegd_op: string;
  notitie: string | null;
  archived_at: string | null;
}
const tabel: Rij[] = [];
let idCounter = 0;

function nieuwId() { idCounter += 1; return `row-${idCounter}`; }

// Bouw een minimale chainable query-builder die de operatoren in
// useAcquisitieSelectie ondersteunt: select/eq/is/order/limit/maybeSingle/single
// + insert/update.
function bouwQuery(table: string) {
  if (table !== 'off_market_acquisitie_selectie') {
    throw new Error(`Onverwachte tabel: ${table}`);
  }
  let rows: Rij[] = [...tabel];
  const api: any = {
    select() { return api; },
    eq(col: keyof Rij, val: unknown) {
      rows = rows.filter(r => r[col] === val);
      return api;
    },
    is(col: keyof Rij, val: unknown) {
      rows = rows.filter(r => r[col] === val);
      return api;
    },
    order(_col: string, opts: { ascending: boolean }) {
      rows = [...rows].sort((a, b) =>
        opts.ascending
          ? a.toegevoegd_op.localeCompare(b.toegevoegd_op)
          : b.toegevoegd_op.localeCompare(a.toegevoegd_op),
      );
      return api;
    },
    limit(n: number) { rows = rows.slice(0, n); return api; },
    maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
    single() {
      if (rows.length === 0) return Promise.resolve({ data: null, error: { message: 'geen rij' } });
      return Promise.resolve({ data: rows[0], error: null });
    },
    then(resolve: (r: { data: Rij[]; error: null }) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
    insert(payload: Partial<Rij>) {
      const r: Rij = {
        id: nieuwId(),
        signaal_id: payload.signaal_id ?? '',
        toegevoegd_door: payload.toegevoegd_door ?? null,
        toegevoegd_op: new Date().toISOString(),
        notitie: payload.notitie ?? null,
        archived_at: null,
      };
      // Partial unique check op signaal_id WHERE archived_at IS NULL.
      if (tabel.some(x => x.signaal_id === r.signaal_id && x.archived_at === null)) {
        const builder: any = {
          select() { return builder; },
          single: () => Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint' } }),
        };
        return builder;
      }
      tabel.push(r);
      const builder: any = {
        select() { return builder; },
        single: () => Promise.resolve({ data: r, error: null }),
      };
      return builder;
    },
    update(patch: Partial<Rij>) {
      const filterRows = rows;
      const target = filterRows;
      for (const t of target) {
        const ref = tabel.find(x => x.id === t.id);
        if (ref) Object.assign(ref, patch);
      }
      const builder: any = {
        eq() { return builder; },
        is() { return builder; },
        select() { return builder; },
        single: () => Promise.resolve({ data: target[0] ?? null, error: null }),
        then: (resolve: (r: { data: null; error: null }) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return builder;
    },
  };
  return api;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => bouwQuery(table),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-test' } } }) },
  },
}));

// Importeer na de mock.
import {
  useAcquisitieSelectie,
  useAcquisitieSelectieCount,
  useIsInAcquisitieSelectie,
  useVoegToeAanAcquisitieSelectie,
  useVerwijderUitAcquisitieSelectie,
} from '@/hooks/useAcquisitieSelectie';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  tabel.length = 0;
  idCounter = 0;
});

describe('useAcquisitieSelectie — basis CRUD', () => {
  it('voegt één signaal toe en telt correct', async () => {
    const Wrapper = wrapper();
    const { result } = renderHook(
      () => ({
        lijst: useAcquisitieSelectie(),
        count: useAcquisitieSelectieCount(),
        inSel: useIsInAcquisitieSelectie('sig-a'),
        voegToe: useVoegToeAanAcquisitieSelectie(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.lijst.isSuccess).toBe(true));
    expect(result.current.count).toBe(0);
    expect(result.current.inSel).toBe(false);

    await act(async () => { await result.current.voegToe.mutateAsync('sig-a'); });
    await waitFor(() => expect(result.current.count).toBe(1));
    expect(result.current.inSel).toBe(true);
    expect(tabel.filter(r => r.archived_at === null)).toHaveLength(1);
  });

  it('dubbel toevoegen levert geen tweede actief item op', async () => {
    const Wrapper = wrapper();
    const { result } = renderHook(
      () => ({
        count: useAcquisitieSelectieCount(),
        voegToe: useVoegToeAanAcquisitieSelectie(),
      }),
      { wrapper: Wrapper },
    );
    await act(async () => { await result.current.voegToe.mutateAsync('sig-a'); });
    await act(async () => { await result.current.voegToe.mutateAsync('sig-a'); });
    await waitFor(() => expect(result.current.count).toBe(1));
    expect(tabel.filter(r => r.signaal_id === 'sig-a' && r.archived_at === null)).toHaveLength(1);
  });

  it('soft-remove verbergt het signaal uit de actieve selectie', async () => {
    const Wrapper = wrapper();
    const { result } = renderHook(
      () => ({
        count: useAcquisitieSelectieCount(),
        voegToe: useVoegToeAanAcquisitieSelectie(),
        verwijder: useVerwijderUitAcquisitieSelectie(),
      }),
      { wrapper: Wrapper },
    );
    await act(async () => { await result.current.voegToe.mutateAsync('sig-b'); });
    await waitFor(() => expect(result.current.count).toBe(1));
    await act(async () => { await result.current.verwijder.mutateAsync('sig-b'); });
    await waitFor(() => expect(result.current.count).toBe(0));
    // Onderliggend record blijft bestaan, maar gearchiveerd.
    expect(tabel).toHaveLength(1);
    expect(tabel[0].archived_at).not.toBeNull();
  });

  it('opnieuw toevoegen na soft-remove heractiveert dezelfde rij', async () => {
    const Wrapper = wrapper();
    const { result } = renderHook(
      () => ({
        count: useAcquisitieSelectieCount(),
        voegToe: useVoegToeAanAcquisitieSelectie(),
        verwijder: useVerwijderUitAcquisitieSelectie(),
      }),
      { wrapper: Wrapper },
    );
    await act(async () => { await result.current.voegToe.mutateAsync('sig-c'); });
    await act(async () => { await result.current.verwijder.mutateAsync('sig-c'); });
    await act(async () => { await result.current.voegToe.mutateAsync('sig-c'); });
    await waitFor(() => expect(result.current.count).toBe(1));
    // Eén onderliggende rij, archived_at terug naar null.
    expect(tabel).toHaveLength(1);
    expect(tabel[0].archived_at).toBeNull();
  });
});
