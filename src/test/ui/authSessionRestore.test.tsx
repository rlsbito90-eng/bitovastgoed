// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

const mocks = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  rolesQuery: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { onAuthStateChange: mocks.onAuthStateChange },
    from: () => ({ select: () => ({ eq: mocks.rolesQuery }) }),
  },
}));

type Callback = (event: string, session: Session | null) => void;
let authEvent: Callback;

function Scherm() {
  const { user, rollen, loading, heeftToegang } = useAuth();
  if (loading) return <span>Bezig met sessie herstellen</span>;
  if (!user) return <span>Inloggen vereist</span>;
  return <span>{heeftToegang ? 'Dashboard beschikbaar' : 'Toegang in afwachting'}; rollen: {rollen.join(',')}</span>;
}

function testSession(userId: string): Session {
  return { user: { id: userId } } as Session;
}

beforeEach(() => {
  mocks.rolesQuery.mockReset();
  mocks.onAuthStateChange.mockReset();
  mocks.unsubscribe.mockReset();
  mocks.onAuthStateChange.mockImplementation((callback: Callback) => {
    authEvent = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
  mocks.rolesQuery.mockResolvedValue({ data: [{ role: 'admin' }], error: null });
});

describe('CRM sessieherstel', () => {
  it('wacht op de bewaarde sessie én rollen voordat het dashboard beschikbaar is', async () => {
    render(<AuthProvider><Scherm /></AuthProvider>);
    expect(screen.getByText('Bezig met sessie herstellen')).toBeTruthy();

    act(() => authEvent('INITIAL_SESSION', testSession('gebruiker-1')));
    expect(screen.getByText('Bezig met sessie herstellen')).toBeTruthy();

    await waitFor(() => expect(screen.getByText('Dashboard beschikbaar; rollen: admin')).toBeTruthy());
    expect(mocks.rolesQuery).toHaveBeenCalledTimes(1);
  });

  it('vraagt alleen opnieuw inloggen wanneer er geen sessie is', () => {
    render(<AuthProvider><Scherm /></AuthProvider>);
    act(() => authEvent('INITIAL_SESSION', null));
    expect(screen.getByText('Inloggen vereist')).toBeTruthy();
    expect(mocks.rolesQuery).not.toHaveBeenCalled();
  });

  it('ververst rollen bij tokenvernieuwing zonder de sessie te wissen', async () => {
    render(<AuthProvider><Scherm /></AuthProvider>);
    act(() => authEvent('INITIAL_SESSION', testSession('gebruiker-1')));
    await waitFor(() => expect(screen.getByText('Dashboard beschikbaar; rollen: admin')).toBeTruthy());

    mocks.rolesQuery.mockResolvedValue({ data: [{ role: 'medewerker' }], error: null });
    act(() => authEvent('TOKEN_REFRESHED', testSession('gebruiker-1')));
    expect(screen.queryByText('Inloggen vereist')).toBeNull();
    await waitFor(() => expect(screen.getByText('Dashboard beschikbaar; rollen: medewerker')).toBeTruthy());
  });

  it('hergebruikt geen oude rollenquery nadat is uitgelogd', async () => {
    let voltooiQuery!: (waarde: { data: { role: string }[]; error: null }) => void;
    mocks.rolesQuery.mockImplementationOnce(() => new Promise(resolve => { voltooiQuery = resolve; }));
    render(<AuthProvider><Scherm /></AuthProvider>);
    act(() => authEvent('INITIAL_SESSION', testSession('gebruiker-1')));
    await waitFor(() => expect(mocks.rolesQuery).toHaveBeenCalledTimes(1));

    act(() => authEvent('SIGNED_OUT', null));
    expect(screen.getByText('Inloggen vereist')).toBeTruthy();
    await act(async () => voltooiQuery({ data: [{ role: 'admin' }], error: null }));
    expect(screen.getByText('Inloggen vereist')).toBeTruthy();
  });
});
