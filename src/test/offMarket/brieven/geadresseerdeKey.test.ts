import { describe, it, expect } from 'vitest';
import { geadresseerdeKey, geadresseerdeDisplayNaam } from '@/lib/offMarket/brieven/geadresseerdeKey';

const base = { id: 'x' as string } as any;

describe('geadresseerdeKey', () => {
  it('dezelfde naam + adres → zelfde key', () => {
    const a = geadresseerdeKey({ ...base, eigenaar_naam: 'A. Voorbeeld', eigenaar_bedrijfsnaam: null, verzendadres: 'Teststraat 1\n1071 VB Amsterdam' });
    const b = geadresseerdeKey({ ...base, eigenaar_naam: '  a. voorbeeld ', eigenaar_bedrijfsnaam: null, verzendadres: 'teststraat 1\n1071vb amsterdam' });
    expect(a).toBe(b);
  });

  it('postcode-spatie wordt genormaliseerd', () => {
    const a = geadresseerdeKey({ ...base, eigenaar_naam: 'X', eigenaar_bedrijfsnaam: null, verzendadres: '1071 VB' });
    const b = geadresseerdeKey({ ...base, eigenaar_naam: 'X', eigenaar_bedrijfsnaam: null, verzendadres: '1071VB' });
    expect(a).toBe(b);
  });

  it('verschillende eigenaren → verschillende keys', () => {
    const a = geadresseerdeKey({ ...base, eigenaar_naam: 'Eigenaar Een', eigenaar_bedrijfsnaam: null, verzendadres: 'Adres 1' });
    const b = geadresseerdeKey({ ...base, eigenaar_naam: 'Eigenaar Twee', eigenaar_bedrijfsnaam: null, verzendadres: 'Adres 1' });
    expect(a).not.toBe(b);
  });

  it('lege brief krijgt unieke fallback', () => {
    const a = geadresseerdeKey({ id: '1', eigenaar_naam: null, eigenaar_bedrijfsnaam: null, verzendadres: null } as any);
    const b = geadresseerdeKey({ id: '2', eigenaar_naam: null, eigenaar_bedrijfsnaam: null, verzendadres: null } as any);
    expect(a).not.toBe(b);
  });

  it('display-naam combineert naam en bedrijf', () => {
    expect(geadresseerdeDisplayNaam({ eigenaar_naam: 'P. Test', eigenaar_bedrijfsnaam: 'Demo BV' } as any))
      .toBe('P. Test — Demo BV');
    expect(geadresseerdeDisplayNaam({ eigenaar_naam: null, eigenaar_bedrijfsnaam: 'Demo BV' } as any))
      .toBe('Demo BV');
  });
});
