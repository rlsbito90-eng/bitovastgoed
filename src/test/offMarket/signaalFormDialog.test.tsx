import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import { signaalToFormState, SIGNAAL_LEEG } from '@/lib/offMarket/form';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import SignaalFormDialog from '@/components/offmarket/SignaalFormDialog';

const hookMocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/useOffMarketSignalen', () => ({
  useCreateOffMarketSignaal: () => ({ isPending: false, mutateAsync: hookMocks.createMutateAsync }),
  useUpdateOffMarketSignaal: () => ({ isPending: false, mutateAsync: hookMocks.updateMutateAsync }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseSignaal = {
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

/**
 * Bug 1 — dirty-guard race.
 * Bij openen van een bestaand signaal moet de baseline gelijk zijn aan de
 * geïnitialiseerde formstate. InnerForm gebruikt useState-initializer +
 * remount via key — dit is gelijk aan een hook waarbij `open` direct true is
 * en de eerste `value` al de signaaldata bevat.
 */
describe('useFormDirtyGuard — Bug 1 (race bij openen bestaand signaal)', () => {
  it('markeert bestaand signaal NIET als dirty bij openen', () => {
    const initial = signaalToFormState(baseSignaal);
    const { result } = renderHook(() =>
      useFormDirtyGuard(true, initial, () => {}),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('markeert leeg formulier NIET als dirty bij openen', () => {
    const { result } = renderHook(() =>
      useFormDirtyGuard(true, SIGNAAL_LEEG, () => {}),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('markeert form WEL als dirty na echte wijziging', () => {
    const initial = signaalToFormState(baseSignaal);
    const { result, rerender } = renderHook(
      ({ value }: { value: typeof initial }) =>
        useFormDirtyGuard(true, value, () => {}),
      { initialProps: { value: initial } },
    );
    expect(result.current.isDirty).toBe(false);

    act(() => {
      rerender({ value: { ...initial, titel: 'Andere titel' } });
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('triggert geen dirty-state als enkel referenties wijzigen zonder inhoud', () => {
    const initial = signaalToFormState(baseSignaal);
    const { result, rerender } = renderHook(
      ({ value }: { value: typeof initial }) =>
        useFormDirtyGuard(true, value, () => {}),
      { initialProps: { value: initial } },
    );
    expect(result.current.isDirty).toBe(false);
    // Zelfde inhoud, nieuwe object-referentie → niet dirty.
    act(() => rerender({ value: { ...initial } }));
    expect(result.current.isDirty).toBe(false);
  });
});

describe('SignaalFormDialog — indicatieve_waarde submit-keten', () => {
  beforeEach(() => {
    hookMocks.createMutateAsync.mockReset();
    hookMocks.updateMutateAsync.mockReset();
    hookMocks.updateMutateAsync.mockResolvedValue({ ...baseSignaal, indicatieve_waarde: 600000 });
  });

  it('stuurt indicatieve_waarde=600000 door bij bestaand signaal en sluit na opslaan', async () => {
    const onOpenChange = vi.fn();
    render(
      <SignaalFormDialog
        open
        signaal={{ ...baseSignaal, indicatieve_waarde: null } as OffMarketSignaal}
        onOpenChange={onOpenChange}
      />,
    );

    const input = screen.getByLabelText('Indicatieve waarde');
    fireEvent.change(input, { target: { value: '600000' } });

    await waitFor(() => {
      expect(screen.getByTestId('signaal-debug-output')).toHaveTextContent('600000');
      expect(screen.getByTestId('signaal-debug-output')).toHaveTextContent('"isDirty": true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bijwerken' }));

    await waitFor(() => {
      expect(hookMocks.updateMutateAsync).toHaveBeenCalledWith({
        id: 'sig-1',
        patch: expect.objectContaining({ indicatieve_waarde: 600000 }),
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
