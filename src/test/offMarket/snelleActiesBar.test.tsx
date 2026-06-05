import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignaalSnelleActiesBar from '@/components/offmarket/SignaalSnelleActiesBar';
import { STATUS_LABEL, STATUS_VOLGORDE } from '@/lib/offMarket/types';
import type { OffMarketSignaal, OffMarketStatus } from '@/lib/offMarket/types';

const hookMocks = vi.hoisted(() => ({ updateMutateAsync: vi.fn() }));

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useUpdateOffMarketSignaal: () => ({
    isPending: false,
    mutateAsync: hookMocks.updateMutateAsync,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const maakSignaal = (status: OffMarketStatus = 'nieuw_signaal'): OffMarketSignaal =>
  ({ id: 'sig-1', status } as unknown as OffMarketSignaal);

beforeEach(() => {
  hookMocks.updateMutateAsync.mockReset();
  hookMocks.updateMutateAsync.mockResolvedValue({});
});

describe('STATUS_LABEL & STATUS_VOLGORDE — nieuwe beoordelingsstatussen', () => {
  it('bevat alle nieuwe statussen in STATUS_LABEL', () => {
    for (const s of ['interessant', 'twijfel', 'eigenaar_gevonden', 'benaderd', 'aanbod_ontvangen', 'afgevallen'] as const) {
      expect(STATUS_LABEL[s]).toBeTruthy();
    }
  });
  it('bevat alle nieuwe statussen in STATUS_VOLGORDE', () => {
    for (const s of ['interessant', 'twijfel', 'eigenaar_gevonden', 'benaderd', 'aanbod_ontvangen', 'afgevallen'] as const) {
      expect(STATUS_VOLGORDE).toContain(s);
    }
  });
});

describe('SignaalSnelleActiesBar', () => {
  const cases: Array<[string, OffMarketStatus]> = [
    ['Interessant', 'interessant'],
    ['Twijfel', 'twijfel'],
    ['Niet interessant', 'niet_interessant'],
    ['Start onderzoek', 'te_onderzoeken'],
    ['Eigenaar achterhalen', 'eigenaar_achterhalen'],
  ];

  for (const [label, status] of cases) {
    it(`klikken op "${label}" wijzigt status naar ${status}`, async () => {
      render(<SignaalSnelleActiesBar signaal={maakSignaal('nieuw_signaal')} />);
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => {
        expect(hookMocks.updateMutateAsync).toHaveBeenCalledWith({
          id: 'sig-1',
          patch: { status },
        });
      });
    });
  }

  it('knop is disabled en active wanneer signaal die status al heeft', () => {
    render(<SignaalSnelleActiesBar signaal={maakSignaal('interessant')} />);
    const btn = screen.getByRole('button', { name: 'Interessant' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('triggert geen update als al in die status', () => {
    render(<SignaalSnelleActiesBar signaal={maakSignaal('twijfel')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Twijfel' }));
    expect(hookMocks.updateMutateAsync).not.toHaveBeenCalled();
  });
});
