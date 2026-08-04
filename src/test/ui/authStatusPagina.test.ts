import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTH_UI_ENABLED } from '@/lib/authConfig';

const authPage = readFileSync('src/pages/AuthPage.tsx', 'utf8');
const protectedRoute = readFileSync('src/components/ProtectedRoute.tsx', 'utf8');

describe('Tijdelijke auth-statuspagina', () => {
  it('heeft de auth-UI centraal uitgeschakeld', () => {
    expect(AUTH_UI_ENABLED).toBe(false);
  });

  it('rendert de login-/registratie-interface uitsluitend achter de centrale vlag', () => {
    expect(authPage).toContain("import { AUTH_UI_ENABLED } from '@/lib/authConfig'");
    expect(authPage).toContain('{!AUTH_UI_ENABLED ? (');
    expect(authPage).toContain('auth-tijdelijke-statuspagina');
    expect(authPage).toContain('De applicatie is tijdelijk niet beschikbaar.');
  });

  it('behoudt de bestaande authenticatiecode voor hergebruik', () => {
    expect(authPage).toContain('<GoogleButton next={next} />');
    expect(authPage).toContain('<AppleButton next={next} />');
    expect(authPage).toContain('Account aanvragen');
    expect(authPage).toContain('signIn(loginEmail, loginWw)');
  });

  it('houdt ProtectedRoute actief zonder omzeiling', () => {
    expect(protectedRoute).toContain('const AUTH_DISABLED = false;');
    expect(protectedRoute).toContain('if (!user) {');
  });
});
