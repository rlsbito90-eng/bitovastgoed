// V2.1 — actief sidebar-item op desktop heeft data-active="true" + accent ring.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isAdmin: false, signOut: vi.fn() }),
}));
vi.mock('@/hooks/useAppRefresh', () => ({ useAutoRefreshOnFocus: () => {} }));
vi.mock('@/hooks/useSwipeMenu', () => ({ useSwipeMenu: () => {} }));
vi.mock('@/components/PullToRefresh', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/NotificationsBell', () => ({ default: () => null }));
vi.mock('@/components/MatchAlertBadge', () => ({ default: () => null }));
vi.mock('@/components/RefreshButton', () => ({ default: () => null }));
vi.mock('@/components/ScrollToTopButton', () => ({ default: () => null }));

import AppLayout from '@/components/AppLayout';

describe('Desktop sidebar — actief item styling', () => {
  it('actieve link heeft data-active="true" en accent ring class', () => {
    render(
      <MemoryRouter initialEntries={['/off-market']}>
        <AppLayout><div>inhoud</div></AppLayout>
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link', { name: /Off-Market Radar/i });
    const actief = links.find(l => l.getAttribute('data-active') === 'true');
    expect(actief).toBeTruthy();
    expect(actief!.className).toMatch(/ring-accent|shadow-/);
  });
});
