// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeyAccessPage from '@/pages/PasskeyAccessPage';

const mocks = vi.hoisted(() => ({
  signInWithPasskey: vi.fn(),
  toastError: vi.fn(),
  originAllowed: { value: true },
  authState: { user: null as { id: string } | null, loading: false },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithPasskey: mocks.signInWithPasskey } },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.authState }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/lib/auth/passkeyOrigin', () => ({
  PASSKEY_ORIGIN: 'https://bitovastgoed.vercel.app',
  isPasskeyOriginAllowed: () => mocks.originAllowed.value,
}));

function renderToegang(path = '/auth') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<PasskeyAccessPage />} />
        <Route path="/" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.originAllowed.value = true;
  mocks.authState.user = null;
  mocks.authState.loading = false;
  mocks.signInWithPasskey.mockReset();
  mocks.toastError.mockReset();
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, value: function PublicKeyCredential() {} });
});

describe('CRM zonder traditioneel inlogformulier', () => {
  it('toont de passkeyknop en geen e-mail- of wachtwoordvelden', () => {
    renderToegang();
    expect(screen.getByRole('button', { name: /Open met Touch ID \/ passkey/i })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText(/Wachtwoord/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Toegang herstellen' }).getAttribute('href')).toBe('/auth/herstel?next=%2F');
  });

  it('opent het CRM na een geldige passkey-sessie', async () => {
    mocks.signInWithPasskey.mockResolvedValue({ error: null });
    renderToegang();
    fireEvent.click(screen.getByRole('button', { name: /Open met Touch ID \/ passkey/i }));
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeTruthy());
    expect(mocks.signInWithPasskey).toHaveBeenCalledTimes(1);
  });

  it('behoudt een beveiligde herstelroute als passkeys niet zijn geactiveerd', async () => {
    mocks.signInWithPasskey.mockResolvedValue({ error: { code: 'passkey_disabled' } });
    renderToegang('/auth?next=%2Ftaken');
    fireEvent.click(screen.getByRole('button', { name: /Open met Touch ID \/ passkey/i }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(screen.getByRole('link', { name: 'Toegang herstellen' }).getAttribute('href'))
      .toBe('/auth/herstel?next=%2Ftaken');
  });

  it('accepteert geen externe redirect via next', () => {
    renderToegang('/auth?next=%2F%2Fmalafide.example');
    expect(screen.getByRole('link', { name: 'Toegang herstellen' }).getAttribute('href')).toBe('/auth/herstel?next=%2F');
  });

  it('verbergt Touch ID op een previewdomein en toont het vaste CRM-adres', () => {
    mocks.originAllowed.value = false;
    renderToegang();
    expect(screen.queryByRole('button', { name: /Open met Touch ID \/ passkey/i })).toBeNull();
    const link = screen.getByRole('link', { name: 'Open het vaste CRM-adres' });
    expect(link.getAttribute('href')).toBe('https://bitovastgoed.vercel.app');
    expect(mocks.signInWithPasskey).not.toHaveBeenCalled();
  });
});
