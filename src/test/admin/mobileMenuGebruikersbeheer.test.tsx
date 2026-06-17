import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

beforeEach(() => {
  // jsdom geen lg-viewport, dus de mobiele header wordt gerenderd (lg:hidden -> zichtbaar)
});

describe('Mobiele drawer — Gebruikersbeheer', () => {
  it('sluit drawer en navigeert naar /admin#gebruikersbeheer', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout>
          <LocationProbe />
        </AppLayout>
      </MemoryRouter>,
    );

    // Open mobiele drawer
    const menuKnop = screen.getByLabelText(/Menu openen/i);
    fireEvent.click(menuKnop);

    // Trigger het GebruikerMenu dropdown in de drawer
    const triggers = screen.getAllByRole('button').filter(b => b.title?.includes('admin@example.test') || /admin@example/.test(b.textContent ?? ''));
    expect(triggers.length).toBeGreaterThan(0);
    fireEvent.pointerDown(triggers[0], { button: 0 });
    fireEvent.click(triggers[0]);

    const link = screen.getByTestId('menu-gebruikersbeheer');
    fireEvent.click(link);

    // Route + hash
    expect(screen.getByTestId('loc').textContent).toBe('/admin#gebruikersbeheer');
    // Drawer-DOM moet sluiten: knop heet weer "Menu openen"
    expect(screen.queryByLabelText(/Menu sluiten/i)).toBeNull();
  });
});
