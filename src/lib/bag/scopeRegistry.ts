export type BagScopeStatus = 'actief' | 'gepland';
export type BagScopeRol = 'commercieel' | 'technische_referentie';

export interface BagScopeDefinitie {
  code: string;
  naam: string;
  status: BagScopeStatus;
  rol: BagScopeRol;
  volgorde: number;
}

export const BAG_COMMERCIËLE_VOORKEURSCODE = '0363';
export const BAG_TECHNISCHE_REFERENTIECODE = '0106';
export const BAG_STANDAARD_ACTIEVE_SCOPECODES = '0363,0106';

export const BAG_SCOPE_REGISTER: readonly BagScopeDefinitie[] = [
  { code: '0363', naam: 'Amsterdam', status: 'actief', rol: 'commercieel', volgorde: 1 },
  { code: '0599', naam: 'Rotterdam', status: 'gepland', rol: 'commercieel', volgorde: 2 },
  { code: '0518', naam: 'Den Haag', status: 'gepland', rol: 'commercieel', volgorde: 3 },
  { code: '0106', naam: 'Assen', status: 'actief', rol: 'technische_referentie', volgorde: 99 },
] as const;

const REGISTER_PER_CODE = new Map(BAG_SCOPE_REGISTER.map(scope => [scope.code, scope]));

export function zoekBagScope(code: string): BagScopeDefinitie | null {
  return REGISTER_PER_CODE.get(code) ?? null;
}

export function parseBagScopeAllowlist(raw: string | undefined): Set<string> {
  const codes = String(raw ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .filter(code => REGISTER_PER_CODE.has(code));
  return new Set(codes);
}

export function bepaalActieveBagScopes(
  rawAllowlist: string | undefined,
  fallbackCode = BAG_TECHNISCHE_REFERENTIECODE,
): BagScopeDefinitie[] {
  const allowlist = parseBagScopeAllowlist(rawAllowlist);
  if (!allowlist.size && REGISTER_PER_CODE.has(fallbackCode)) allowlist.add(fallbackCode);

  return BAG_SCOPE_REGISTER
    .filter(scope => allowlist.has(scope.code))
    .map(scope => ({ ...scope, status: 'actief' as const }))
    .sort((a, b) => a.volgorde - b.volgorde);
}

export function bepaalVoorkeursBagScope(
  actieveScopes: readonly BagScopeDefinitie[],
): BagScopeDefinitie | null {
  if (!actieveScopes.length) return null;
  return actieveScopes.find(scope => scope.code === BAG_COMMERCIËLE_VOORKEURSCODE)
    ?? actieveScopes.find(scope => scope.rol === 'commercieel')
    ?? actieveScopes.find(scope => scope.code === BAG_TECHNISCHE_REFERENTIECODE)
    ?? actieveScopes[0];
}

export function isBagScopeToegestaan(code: string, toegestaneCodes: Set<string>): boolean {
  return REGISTER_PER_CODE.has(code) && toegestaneCodes.has(code);
}
