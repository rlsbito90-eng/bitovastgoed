// V2.1 — StatusWijzigDropdown bevat alle keys uit STATUS_LABEL.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StatusWijzigDropdown from '@/components/offmarket/overzicht/StatusWijzigDropdown';
import { STATUS_LABEL, STATUS_VOLGORDE } from '@/lib/offMarket/types';

// Radix Select gebruikt PointerCapture API die jsdom niet implementeert.
beforeAll(() => {
  if (!(HTMLElement.prototype as any).hasPointerCapture) {
    (HTMLElement.prototype as any).hasPointerCapture = () => false;
    (HTMLElement.prototype as any).releasePointerCapture = () => {};
    (HTMLElement.prototype as any).setPointerCapture = () => {};
  }
  if (!(HTMLElement.prototype as any).scrollIntoView) {
    (HTMLElement.prototype as any).scrollIntoView = () => {};
  }
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }) }),
  },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const baseSignaal: any = {
  id: 's1', status: 'nieuw_signaal', prioriteit: 'midden', assettype: 'wonen',
  titel: 'X', signaaltype: 'overig',
};

describe('StatusWijzigDropdown — alle statussen', () => {
  it('STATUS_VOLGORDE bevat alle keys uit STATUS_LABEL', () => {
    const labelKeys = Object.keys(STATUS_LABEL).sort();
    expect([...STATUS_VOLGORDE].sort()).toEqual(labelKeys);
  });

  it('toont alle keys uit STATUS_LABEL na openen', async () => {
    const user = userEvent.setup();
    render(wrap(<StatusWijzigDropdown signaal={baseSignaal} variant="inline" />));
    await user.click(screen.getByTestId('status-wijzig-dropdown'));
    for (const key of STATUS_VOLGORDE) {
      const opties = await screen.findAllByTestId(`status-optie-${key}`);
      expect(opties.length).toBeGreaterThan(0);
      expect(opties[0].textContent).toContain(STATUS_LABEL[key]);
    }
  });
});
