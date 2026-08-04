import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTH_UI_ENABLED, AUTH_SOCIAL_ENABLED, AUTH_SIGNUP_ENABLED } from '@/lib/authConfig';

const authPage = readFileSync('src/pages/AuthPage.tsx', 'utf8');
const protectedRoute = readFileSync('src/components/ProtectedRoute.tsx', 'utf8');

describe('Auth-interface', () => {
  it('toont de auth-UI weer', () => {
    expect(AUTH_UI_ENABLED).toBe(true);
  });

  it('houdt social login en zelfregistratie verborgen', () => {
    expect(AUTH_SOCIAL_ENABLED).toBe(false);
    expect(AUTH_SIGNUP_ENABLED).toBe(false);
  });

  it('rendert Google/Apple en registratie uitsluitend achter hun vlag', () => {
    expect(authPage).toContain('{AUTH_SOCIAL_ENABLED && (');
    expect(authPage).toContain('{AUTH_SIGNUP_ENABLED && (');
  });

  it('behoudt de e-mail/wachtwoordlogin', () => {
    expect(authPage).toContain('signIn(loginEmail, loginWw)');
    expect(authPage).toContain('id="login-email"');
    expect(authPage).toContain('id="login-ww"');
  });

  it('houdt ProtectedRoute actief zonder omzeiling', () => {
    expect(protectedRoute).toContain('const AUTH_DISABLED = false;');
    expect(protectedRoute).toContain('if (!user) {');
  });
});
