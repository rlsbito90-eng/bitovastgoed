import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  it('navigeert via menu-link naar /admin#gebruikersbeheer met juiste onClick-binding', async () => {
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
    await screen.findByLabelText(/Menu sluiten/i);

    // Open het GebruikerMenu (Radix dropdown) via de e-mailknop in de drawer
    const trigger = screen
      .getAllByRole('button')
      .find((b) => (b.textContent ?? '').includes('admin@example.test'));
    expect(trigger).toBeTruthy();
    await user.click(trigger as HTMLElement);

    // Menu-item wordt in Radix-portal gerenderd
    const link = await screen.findByTestId('menu-gebruikersbeheer');
    expect(link.getAttribute('href')).toBe('/admin#gebruikersbeheer');

    await user.click(link);

    // Navigatie heeft plaatsgevonden
    expect(screen.getByTestId('loc').textContent).toBe('/admin#gebruikersbeheer');
  });
});
