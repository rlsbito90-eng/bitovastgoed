import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('herstel oorspronkelijke CRM-login', () => {
  const login = readFileSync('src/pages/AuthPage.tsx', 'utf8');
  const recovery = readFileSync('src/pages/AuthRecoveryPage.tsx', 'utf8');
  const app = readFileSync('src/App.tsx', 'utf8');

  it('toont het oude formulier met e-mailadres, wachtwoord en directe inlogknop', () => {
    expect(login).toContain('id="login-email"');
    expect(login).toContain('id="login-ww"');
    expect(login).toContain('signIn(loginEmail, loginWw)');
    expect(login).toContain('Inloggen');
    expect(login).not.toContain('stuurToegangslink');
  });

  it('behoudt een herstelroute zonder de reguliere login te vervangen', () => {
    expect(recovery).toContain('stuurToegangslink');
    expect(login).toContain('/auth/herstel?next=');
    expect(app).toContain('const AuthRecoveryPage');
    expect(app).toContain('<AuthRecoveryPage />} />');
  });

  it('laat de offline previews en productie-autorisatie ongemoeid', () => {
    expect(app).toContain('IS_OFFLINE_PREVIEW ? <Navigate to="/" replace />');
    expect(app).toContain('isBitoPreviewOrigin(window.location.origin) ? <PasskeyAccessPage /> : <AuthPage />');
  });
});
