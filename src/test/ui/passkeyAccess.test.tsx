// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeyAccessPage from '@/pages/PasskeyAccessPage';

const mocks = vi.hoisted(() => ({
  signInWithPasskey: vi.fn(),
  toastError: vi.fn(),
  originAllowed: { value: true },
  previewOrigin: { value: false },
  verifyOtp: vi.fn(),
  popupWindow: { postMessage: vi.fn() },
  authState: { user: null as { id: string } | null, loading: false },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signInWithPasskey: mocks.signInWithPasskey, verifyOtp: mocks.verifyOtp } },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.authState }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/lib/auth/passkeyOrigin', () => ({
  PASSKEY_ORIGIN: 'https://bitovastgoed.vercel.app',
  isPasskeyOriginAllowed: () => mocks.originAllowed.value,
}));
vi.mock('@/lib/auth/previewSso', () => ({
  CRM_PRIMARY_ORIGIN: 'https://bitovastgoed.vercel.app',
  isBitoPreviewOrigin: () => mocks.previewOrigin.value,
  createPreviewNonce: () => 'a'.repeat(64),
  PREVIEW_LOGIN_MESSAGE: 'bito-crm-preview-login-v1',
  PREVIEW_LOGIN_ACK: 'bito-crm-preview-login-ack-v1',
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
  mocks.previewOrigin.value = false;
  mocks.verifyOtp.mockReset();
  mocks.popupWindow.postMessage.mockReset();
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

  it('verbergt Touch ID op een onbekend domein en toont het vaste CRM-adres', () => {
    mocks.originAllowed.value = false;
    renderToegang();
    expect(screen.queryByRole('button', { name: /Open met Touch ID \/ passkey/i })).toBeNull();
    const link = screen.getByRole('link', { name: 'Open het vaste CRM-adres' });
    expect(link.getAttribute('href')).toBe('https://bitovastgoed.vercel.app');
    expect(mocks.signInWithPasskey).not.toHaveBeenCalled();
  });

  it('opent in previews een popup op het vaste CRM-adres zonder wachtwoord', () => {
    mocks.originAllowed.value = false;
    mocks.previewOrigin.value = true;
    const open = vi.spyOn(window, 'open').mockImplementation(() => mocks.popupWindow as unknown as Window);
    try {
      renderToegang();
      fireEvent.click(screen.getByRole('button', { name: 'Aanmelden via Touch ID' }));
      expect(open).toHaveBeenCalledTimes(1);
      const url = new URL(String(open.mock.calls[0][0]));
      expect(url.origin).toBe('https://bitovastgoed.vercel.app');
      expect(url.pathname).toBe('/auth/preview-bridge');
      expect(url.searchParams.get('nonce')).toBe('a'.repeat(64));
    } finally {
      open.mockRestore();
    }
  });

  it('aanvaardt uitsluitend de grant uit de juiste popup met de juiste nonce', async () => {
    mocks.originAllowed.value = false;
    mocks.previewOrigin.value = true;
    mocks.verifyOtp.mockResolvedValue({ error: null });
    const open = vi.spyOn(window, 'open').mockImplementation(() => mocks.popupWindow as unknown as Window);
    try {
      renderToegang();
      fireEvent.click(screen.getByRole('button', { name: 'Aanmelden via Touch ID' }));
      const grant = { type: 'bito-crm-preview-login-v1', nonce: 'a'.repeat(64), tokenHash: 'b'.repeat(64) };

      await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
          origin: 'https://evil.example',
          source: mocks.popupWindow as unknown as MessageEventSource,
          data: grant,
        }));
      });
      expect(mocks.verifyOtp).not.toHaveBeenCalled();

      await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
          origin: 'https://bitovastgoed.vercel.app',
          source: mocks.popupWindow as unknown as MessageEventSource,
          data: grant,
        }));
      });
      await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'b'.repeat(64) }));
      await waitFor(() => expect(screen.getByText('Dashboard')).toBeTruthy());
      expect(mocks.popupWindow.postMessage).toHaveBeenCalledWith({
        type: 'bito-crm-preview-login-ack-v1',
        nonce: 'a'.repeat(64),
      }, 'https://bitovastgoed.vercel.app');
    } finally {
      open.mockRestore();
    }
  });
});
