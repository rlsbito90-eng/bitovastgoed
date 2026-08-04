export type BagScopeStatus = 'actief' | 'gepland';

export interface BagScopeDefinitie {
  code: string;
  naam: string;
  status: BagScopeStatus;
  volgorde: number;
}

export const BAG_SCOPE_REGISTER: readonly BagScopeDefinitie[] = [
  { code: '0106', naam: 'Assen', status: 'actief', volgorde: 0 },
  { code: '0363', naam: 'Amsterdam', status: 'gepland', volgorde: 1 },
  { code: '0599', naam: 'Rotterdam', status: 'gepland', volgorde: 2 },
  { code: '0518', naam: 'Den Haag', status: 'gepland', volgorde: 3 },
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
  fallbackCode = '0106',
): BagScopeDefinitie[] {
  const allowlist = parseBagScopeAllowlist(rawAllowlist);
  if (!allowlist.size && REGISTER_PER_CODE.has(fallbackCode)) allowlist.add(fallbackCode);

  return BAG_SCOPE_REGISTER
    .filter(scope => allowlist.has(scope.code))
    .map(scope => ({ ...scope, status: 'actief' as const }))
    .sort((a, b) => a.volgorde - b.volgorde);
}

export function isBagScopeToegestaan(code: string, toegestaneCodes: Set<string>): boolean {
  return REGISTER_PER_CODE.has(code) && toegestaneCodes.has(code);
}
