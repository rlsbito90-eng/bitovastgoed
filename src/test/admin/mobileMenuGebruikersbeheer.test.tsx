import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@example.test' },
    isAdmin: true,
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAppRefresh', () => ({ useAutoRefreshOnFocus: () => {} }));
vi.mock('@/hooks/useSwipeMenu', () => ({ useSwipeMenu: () => {} }));
vi.mock('@/components/PullToRefresh', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/RefreshButton', () => ({ default: () => null }));
vi.mock('@/components/MatchAlertBadge', () => ({ default: () => null }));
vi.mock('@/components/NotificationsBell', () => ({ default: () => null }));
vi.mock('@/components/ScrollToTopButton', () => ({ default: () => null }));

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}{loc.hash}</span>;
}

describe('Mobiele drawer — Gebruikersbeheer', () => {
  it('sluit drawer en navigeert naar /admin#gebruikersbeheer', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout>
          <LocationProbe />
        </AppLayout>
      </MemoryRouter>,
    );

    // Open mobiele drawer
    await user.click(screen.getByLabelText(/Menu openen/i));

    // Wacht tot drawer open is (sluit-knop verschijnt)
    await screen.findByLabelText(/Menu sluiten/i);

    // Open het GebruikerMenu dropdown door op trigger met e-mail te klikken
    const trigger = await screen.findByTitle('admin@example.test').catch(() => null)
      ?? screen.getAllByRole('button').find(b => (b.textContent ?? '').includes('admin@example.test'));
    expect(trigger).toBeTruthy();
    await user.click(trigger as HTMLElement);

    // Wacht op menu-item in Radix portal
    const link = await screen.findByTestId('menu-gebruikersbeheer');
    await user.click(link);

    // Route + hash via react-router
    await waitFor(() => {
      expect(screen.getByTestId('loc').textContent).toBe('/admin#gebruikersbeheer');
    });
    // Drawer is gesloten: sluit-knop bestaat niet meer
    await waitFor(() => {
      expect(screen.queryByLabelText(/Menu sluiten/i)).toBeNull();
    });
  });
});
