import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BronInstellingenPanel from '@/components/admin/BronInstellingenPanel';
import type { OffMarketBron } from '@/hooks/useOffMarketBronnen';

const mutateAsync = vi.fn();

vi.mock('@/hooks/useOffMarketBronnen', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useOffMarketBronnen')>('@/hooks/useOffMarketBronnen');
  return {
    ...actual,
    useUpdateBronInstellingen: () => ({ mutateAsync, isPending: false }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function bron(over: Partial<OffMarketBron> = {}): OffMarketBron {
  return {
    id: 'ams', naam: 'Bekendmakingen Amsterdam', type: 'bekendmaking', actief: true,
    endpoint_url: null, laatste_run_op: null, laatste_run_status: null, laatste_fout: null,
    auto_import: true, auto_verwerken: true,
    frequentie: 'dagelijks', dag_van_week: null, tijdstip_uur: 15, tijdstip_minuut: 30,
    max_records_per_run: 500, normalize_batch_size: 200,
    lookback_days_default: 7, lookback_overlap_uren: 24,
    volgende_run_op: '2026-06-14T13:30:00.000Z', laatste_sync_op: null, auto_start_op: '2026-06-14',
    backfill_vanaf: null, backfill_tot: null, backfill_cursor: 0,
    backfill_server_total: null, backfill_status: 'niet_gestart',
    ...over,
  };
}

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

describe('BronInstellingenPanel minutenplanning', () => {
  it('UI haalt tijdstip_minuut=30 op en toont 15:30', () => {
    render(<BronInstellingenPanel bron={bron()} />);
    expect(screen.getByText('15:30')).toBeInTheDocument();
  });

  it('opslaan tijdstip 15:30 schrijft tijdstip_uur=15 en tijdstip_minuut=30', async () => {
    const user = userEvent.setup();
    const b = bron();
    render(<BronInstellingenPanel bron={b} />);

    await user.click(screen.getByRole('button', { name: /Instellingen opslaan/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'ams',
      huidig: b,
      patch: expect.objectContaining({
        tijdstip_uur: 15,
        tijdstip_minuut: 30,
      }),
    });
  });
});