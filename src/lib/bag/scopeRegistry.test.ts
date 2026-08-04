import { describe, expect, it } from 'vitest';
import {
  BAG_COMMERCIËLE_VOORKEURSCODE,
  BAG_SCOPE_REGISTER,
  BAG_TECHNISCHE_REFERENTIECODE,
  bepaalActieveBagScopes,
  bepaalVoorkeursBagScope,
  isBagScopeToegestaan,
  parseBagScopeAllowlist,
  zoekBagScope,
} from './scopeRegistry';

describe('BAG scoperegister', () => {
  it('registreert Amsterdam als commerciële voorkeur en Assen als technische referentie', () => {
    expect(BAG_SCOPE_REGISTER.map(scope => scope.code)).toEqual(['0363', '0599', '0518', '0106']);
    expect(BAG_COMMERCIËLE_VOORKEURSCODE).toBe('0363');
    expect(BAG_TECHNISCHE_REFERENTIECODE).toBe('0106');
    expect(zoekBagScope('0363')).toMatchObject({ naam: 'Amsterdam', rol: 'commercieel' });
    expect(zoekBagScope('0106')).toMatchObject({ naam: 'Assen', rol: 'technische_referentie' });
    expect(zoekBagScope('9999')).toBeNull();
  });

  it('negeert onbekende en lege scopewaarden', () => {
    expect([...parseBagScopeAllowlist('0106, 0363, ,9999')]).toEqual(['0106', '0363']);
  });

  it('valt veilig terug op alleen Assen wanneer geen allowlist is gezet', () => {
    const actief = bepaalActieveBagScopes(undefined);
    expect(actief.map(scope => scope.code)).toEqual(['0106']);
    expect(bepaalVoorkeursBagScope(actief)?.code).toBe('0106');
  });

  it('kiest Amsterdam automatisch zodra die scope expliciet actief is', () => {
    const actief = bepaalActieveBagScopes('0106,0363');
    expect(actief.map(scope => scope.code)).toEqual(['0363', '0106']);
    expect(bepaalVoorkeursBagScope(actief)?.code).toBe('0363');
  });

  it('kiest de eerstvolgende commerciële scope wanneer Amsterdam niet actief is', () => {
    const actief = bepaalActieveBagScopes('0106,0599');
    expect(bepaalVoorkeursBagScope(actief)?.code).toBe('0599');
  });

  it('activeert uitsluitend expliciet toegestane geregistreerde scopes', () => {
    const actief = bepaalActieveBagScopes('0599,0363');
    expect(actief.map(scope => scope.code)).toEqual(['0363', '0599']);
    expect(isBagScopeToegestaan('0363', new Set(actief.map(scope => scope.code)))).toBe(true);
    expect(isBagScopeToegestaan('0518', new Set(actief.map(scope => scope.code)))).toBe(false);
  });
});
