// V2.4 fix — Resolver crasht niet als kandidaten undefined/null bevatten.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BagMatchResolver from '@/components/offmarket/bag/BagMatchResolver';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  },
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('BagMatchResolver — undefined/null kandidaten', () => {
  it('rendert zonder crash met undefined/null entries', () => {
    const kandidaten = [
      undefined,
      null,
      { adres: 'Frans Halsstraat 100-H', vbo_id: 'v-abc', nummeraanduiding_id: 'na-abc' },
    ] as any;
    const { getByTestId, getAllByTestId } = wrap(
      <BagMatchResolver signaalId="sig-1" kandidaten={kandidaten} />,
    );
    expect(getByTestId('bag-match-resolver')).toBeInTheDocument();
    const cards = getAllByTestId('bag-match-kandidaat');
    expect(cards).toHaveLength(1);
  });

  it('crasht niet als kandidaten zelf null of undefined is', () => {
    expect(() =>
      wrap(<BagMatchResolver signaalId="sig-1" kandidaten={null as any} />),
    ).not.toThrow();
    expect(() =>
      wrap(<BagMatchResolver signaalId="sig-1" kandidaten={undefined as any} />),
    ).not.toThrow();
  });
});
