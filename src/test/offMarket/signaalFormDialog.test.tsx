import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignaalFormDialog from '@/components/offmarket/SignaalFormDialog';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

// Stub hooks die echte Supabase calls doen.
vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useCreateOffMarketSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateOffMarketSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const baseSignaal: OffMarketSignaal = {
  id: 'sig-1',
  titel: 'Leegstaand kantoor Stationsweg',
  assettype: 'kantoor',
  bron_type: 'handmatig',
  type_signaal: 'handmatige_research',
  status: 'nieuw_signaal',
  prioriteit: 'midden',
  adres: 'Stationsweg 12',
  postcode: '1234 AB',
  plaats: 'Utrecht',
  provincie: 'Utrecht',
  regio: 'Randstad',
  omschrijving: 'Test',
  bron_url: null,
  bron_referentie: null,
  bron_datum: '2026-05-01',
  indicatieve_waarde: 1500000,
  mogelijke_fee: 25000,
  potentiele_strategie: null,
  volgende_actie_datum: null,
  volgende_actie_omschrijving: null,
  notities: null,
} as unknown as OffMarketSignaal;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('SignaalFormDialog — dirty-guard (Bug 1)', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    confirmSpy.mockRestore();
    cleanup();
  });

  it('opent bestaand signaal zonder dirty-state (geen confirm bij direct sluiten)', () => {
    const onOpenChange = vi.fn();
    wrap(
      <SignaalFormDialog open={true} onOpenChange={onOpenChange} signaal={baseSignaal} />,
    );
    // Annuleren direct na openen — er is niets gewijzigd.
    fireEvent.click(screen.getByRole('button', { name: /annuleren/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('echte wijziging markeert form als dirty (confirm verschijnt bij sluiten)', () => {
    const onOpenChange = vi.fn();
    wrap(
      <SignaalFormDialog open={true} onOpenChange={onOpenChange} signaal={baseSignaal} />,
    );
    const titelInput = screen.getByDisplayValue(baseSignaal.titel) as HTMLInputElement;
    fireEvent.change(titelInput, { target: { value: 'Gewijzigde titel' } });
    fireEvent.click(screen.getByRole('button', { name: /annuleren/i }));
    // Annuleren-knop sluit zonder guard, dus check via Esc:
    // We forceren close door onOpenChange(false) via guardedOnOpenChange — annuleren is direct.
    // Reset en test via Esc:
    cleanup();
    onOpenChange.mockClear();
    wrap(
      <SignaalFormDialog open={true} onOpenChange={onOpenChange} signaal={baseSignaal} />,
    );
    const titelInput2 = screen.getByDisplayValue(baseSignaal.titel) as HTMLInputElement;
    fireEvent.change(titelInput2, { target: { value: 'Andere titel' } });
    // Trigger overlay close via Escape op de dialog
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });
    // Bij dirty-state moet confirm aangeroepen zijn.
    expect(confirmSpy).toHaveBeenCalled();
  });
});
