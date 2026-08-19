import { describe, expect, it } from 'vitest';
import {
  bewaarCrmDetailOrigin,
  bepaalNieuweCrmDetailOrigin,
  leesCrmDetailOrigin,
} from '@/lib/crmReturnContext';

function geheugenStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

describe('CRM detail-origin', () => {
  it('legt de volledige werkcontext vast bij lijst -> detail', () => {
    expect(bepaalNieuweCrmDetailOrigin({
      vorigePathname: '/off-market',
      vorigeVolledigePad: '/off-market?tab=selectie#werkbak',
      huidigePathname: '/off-market/s1',
    })).toEqual({
      module: 'off-market',
      path: '/off-market?tab=selectie#werkbak',
    });
  });

  it('overschrijft de origin niet bij detail -> detail', () => {
    expect(bepaalNieuweCrmDetailOrigin({
      vorigePathname: '/off-market/s1',
      vorigeVolledigePad: '/off-market/s1?mode=normaal',
      huidigePathname: '/off-market/s2',
    })).toBeNull();

    expect(bepaalNieuweCrmDetailOrigin({
      vorigePathname: '/relaties/r1',
      vorigeVolledigePad: '/relaties/r1',
      huidigePathname: '/objecten/o1',
    })).toBeNull();
  });

  it('kan ook dashboard/pipeline als geldige herkomst onthouden', () => {
    expect(bepaalNieuweCrmDetailOrigin({
      vorigePathname: '/pipeline',
      vorigeVolledigePad: '/pipeline?fase=match',
      huidigePathname: '/relaties/r1',
    })).toEqual({ module: 'relaties', path: '/pipeline?fase=match' });
  });

  it('schrijft en leest origin veilig per module', () => {
    const storage = geheugenStorage();
    bewaarCrmDetailOrigin('objecten', '/objecten?tab=dealflow', storage);
    bewaarCrmDetailOrigin('deals', '/deals?fase=actief', storage);

    expect(leesCrmDetailOrigin('objecten', storage)).toBe('/objecten?tab=dealflow');
    expect(leesCrmDetailOrigin('deals', storage)).toBe('/deals?fase=actief');
  });

  it('weigert externe/ongeldige origins', () => {
    const storage = geheugenStorage();
    bewaarCrmDetailOrigin('taken', 'https://example.com', storage);
    expect(leesCrmDetailOrigin('taken', storage)).toBeNull();
  });
});
