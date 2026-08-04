import { describe, expect, it } from 'vitest';
import {
  BAG_SCOPE_REGISTER,
  bepaalActieveBagScopes,
  isBagScopeToegestaan,
  parseBagScopeAllowlist,
  zoekBagScope,
} from './scopeRegistry';

describe('BAG scoperegister', () => {
  it('registreert Assen en de drie commerciële vervolgscopes', () => {
    expect(BAG_SCOPE_REGISTER.map(scope => scope.code)).toEqual(['0106', '0363', '0599', '0518']);
    expect(zoekBagScope('0363')?.naam).toBe('Amsterdam');
    expect(zoekBagScope('9999')).toBeNull();
  });

  it('negeert onbekende en lege scopewaarden', () => {
    expect([...parseBagScopeAllowlist('0106, 0363, ,9999')]).toEqual(['0106', '0363']);
  });

  it('valt veilig terug op alleen Assen wanneer geen allowlist is gezet', () => {
    expect(bepaalActieveBagScopes(undefined).map(scope => scope.code)).toEqual(['0106']);
  });

  it('activeert uitsluitend expliciet toegestane geregistreerde scopes', () => {
    const actief = bepaalActieveBagScopes('0599,0363');
    expect(actief.map(scope => scope.code)).toEqual(['0363', '0599']);
    expect(isBagScopeToegestaan('0363', new Set(actief.map(scope => scope.code)))).toBe(true);
    expect(isBagScopeToegestaan('0518', new Set(actief.map(scope => scope.code)))).toBe(false);
  });
});
