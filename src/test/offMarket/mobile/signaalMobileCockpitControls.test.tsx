// Mobiele cockpit: prioriteit en eigenaarstatus moeten als klikbare controls aanwezig zijn.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import { maakTestSignaal } from './_fixture';

beforeAll(() => {
  if (!(HTMLElement.prototype as any).hasPointerCapture) {
    (HTMLElement.prototype as any).hasPointerCapture = () => false;
    (HTMLElement.prototype as any).releasePointerCapture = () => {};
    (HTMLElement.prototype as any).setPointerCapture = () => {};
  }
});

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useUpdateOffMarketSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SignaalMobileCockpit — controls', () => {
  it('rendert status, prioriteit en eigenaarstatus als klikbare dropdowns', () => {
    const signaal = maakTestSignaal({ prioriteit: 'midden', eigenaarstatus: 'gevonden' } as any);
    wrap(<SignaalMobileCockpit signaal={signaal} taken={[]} briefStatus="geen" />);
    expect(screen.getByTestId('status-wijzig-compact')).toBeInTheDocument();
    expect(screen.getByTestId('prioriteit-wijzig-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('eigenaarstatus-wijzig-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Prioriteit')).toBeInTheDocument();
  });
});
