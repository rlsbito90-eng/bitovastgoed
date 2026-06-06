import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SignaalEigenaarsonderzoekSectie from '@/components/offmarket/SignaalEigenaarsonderzoekSectie';
import {
  EIGENAARSTATUS_LABEL, EIGENAARSTATUS_VOLGORDE,
  EIGENAARTYPE_LABEL, EIGENAARBRON_LABEL,
} from '@/lib/offMarket/types';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const hookMocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useUpdateOffMarketSignaal: () => ({ isPending: false, mutateAsync: hookMocks.mutateAsync }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseSignaal = {
  id: 'sig-1',
  status: 'nieuw_signaal',
  eigenaarstatus: 'onbekend',
  eigenaar_naam: 'Jan Janssen',
  eigenaar_email: 'jan@example.com',
} as unknown as OffMarketSignaal;

beforeEach(() => {
  hookMocks.mutateAsync.mockReset();
  hookMocks.mutateAsync.mockResolvedValue({});
});

describe('Eigenaar enums/labels', () => {
  it('EIGENAARSTATUS_LABEL bevat alle waarden', () => {
    for (const k of ['onbekend','te_onderzoeken','gevonden','benaderd','in_gesprek','niet_bereikbaar','geen_interesse'] as const) {
      expect(EIGENAARSTATUS_LABEL[k]).toBeTruthy();
      expect(EIGENAARSTATUS_VOLGORDE).toContain(k);
    }
  });
  it('EIGENAARTYPE_LABEL bevat alle waarden', () => {
    for (const k of ['particulier','bv','stichting','vve','overheid','onbekend'] as const) {
      expect(EIGENAARTYPE_LABEL[k]).toBeTruthy();
    }
  });
  it('EIGENAARBRON_LABEL bevat alle waarden', () => {
    for (const k of ['kadaster','kvk','google','linkedin','netwerk','anders'] as const) {
      expect(EIGENAARBRON_LABEL[k]).toBeTruthy();
    }
  });
});

describe('SignaalEigenaarsonderzoekSectie — render & acties', () => {
  it('rendert sectie met titel en read-only velden', () => {
    render(<SignaalEigenaarsonderzoekSectie signaal={baseSignaal} />);
    expect(screen.getByTestId('eigenaarsonderzoek-sectie')).toBeTruthy();
    expect(screen.getByText('Eigenaarsonderzoek')).toBeTruthy();
    expect(screen.getByText('Jan Janssen')).toBeTruthy();
    expect(screen.getByText('jan@example.com')).toBeTruthy();
  });

  it('Kadaster check uitgevoerd zet kadaster_check_op = now()', async () => {
    render(<SignaalEigenaarsonderzoekSectie signaal={baseSignaal} />);
    fireEvent.click(screen.getByRole('button', { name: /Kadaster check uitgevoerd/i }));
    await waitFor(() => expect(hookMocks.mutateAsync).toHaveBeenCalled());
    const call = hookMocks.mutateAsync.mock.calls[0][0];
    expect(call.id).toBe('sig-1');
    expect(call.patch.kadaster_check_op).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('Eigenaar gevonden zet eigenaarstatus, eigenaar_bekend en status', async () => {
    render(<SignaalEigenaarsonderzoekSectie signaal={baseSignaal} />);
    fireEvent.click(screen.getByRole('button', { name: /Eigenaar gevonden/i }));
    await waitFor(() => expect(hookMocks.mutateAsync).toHaveBeenCalledWith({
      id: 'sig-1',
      patch: { eigenaarstatus: 'gevonden', eigenaar_bekend: true, status: 'eigenaar_gevonden' },
    }));
  });

  it('Eigenaar benaderen zet eigenaarstatus en status', async () => {
    render(<SignaalEigenaarsonderzoekSectie signaal={baseSignaal} />);
    fireEvent.click(screen.getByRole('button', { name: /Eigenaar benaderen/i }));
    await waitFor(() => expect(hookMocks.mutateAsync).toHaveBeenCalledWith({
      id: 'sig-1',
      patch: { eigenaarstatus: 'benaderd', status: 'benaderd' },
    }));
  });

  it('bewerken → wijziging → opslaan stuurt patch', async () => {
    render(<SignaalEigenaarsonderzoekSectie signaal={baseSignaal} />);
    fireEvent.click(screen.getByRole('button', { name: /Bewerken/i }));
    const tel = screen.getByDisplayValue('') as HTMLInputElement; // first empty field — fallback below
    // robuuster: zoek op label-volgorde via getAllByRole('textbox')
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    // form-veld voor telefoon: zoek input met type tel
    const telInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(telInput, { target: { value: '0612345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Opslaan$/i }));
    await waitFor(() => expect(hookMocks.mutateAsync).toHaveBeenCalled());
    const call = hookMocks.mutateAsync.mock.calls[0][0];
    expect(call.patch.eigenaar_telefoon).toBe('0612345678');
    // Onveranderde velden blijven hun waarde houden
    expect(call.patch.eigenaar_naam).toBe('Jan Janssen');
  });

  it('bewerken → wijziging → annuleren stuurt geen update', async () => {
    // confirm() altijd true zodat dirty-guard discard accepteert
    const origConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    try {
      render(<SignaalEigenaarsonderzoekSectie signaal={baseSignaal} />);
      fireEvent.click(screen.getByRole('button', { name: /Bewerken/i }));
      const telInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      fireEvent.change(telInput, { target: { value: '0699999999' } });
      fireEvent.click(screen.getByRole('button', { name: /Annuleren/i }));
      expect(hookMocks.mutateAsync).not.toHaveBeenCalled();
    } finally {
      window.confirm = origConfirm;
    }
  });
});
