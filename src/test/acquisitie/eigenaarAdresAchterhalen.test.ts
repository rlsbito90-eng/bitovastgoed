import { describe, expect, it } from 'vitest';
import {
  bepaalRechtenbewusteEigenaar,
  bouwAutomatischeEigenaarPatch,
  isAdresControleReden,
} from '@/lib/offMarket/acquisitie/rechtenbewusteEigenaar';
import { bepaalSignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';

const cleefBlok = {
  persoonType: 'natuurlijk',
  naam: 'Elisabeth Wilhelmina Cleef',
  bedrijfsnaam: null,
  kvkNummer: null,
  rechtstype: 'Eigendom (recht van)',
  aandeel: '1/1',
  adresRegels: [],
  postcode: null,
  plaats: null,
  kadastraleAanduiding: 'Amsterdam AB 10655',
} as any;

describe('eigenaar gevonden, adres achterhalen', () => {
  it('classificeert een ontbrekend Kadasteradres niet als identiteitsexceptie', () => {
    expect(isAdresControleReden('Adresgegevens van de primaire rechthebbende zijn onvolledig.')).toBe(true);
    expect(isAdresControleReden('De primaire rechthebbende kan niet veilig automatisch worden bepaald.')).toBe(false);
  });

  it('vervangt stale automatisch afgeleide eigenaarvelden en wist een oud placeholderadres', () => {
    const uitkomst = bepaalRechtenbewusteEigenaar([cleefBlok]);
    expect(uitkomst.status).toBe('eenduidig');
    expect(uitkomst.controleNodig).toBe(true);

    const patch = bouwAutomatischeEigenaarPatch({
      eigenaarbron: 'kadaster',
      eigenaarstatus: 'gevonden',
      eigenaar_bekend: true,
      eigenaar_type: 'overheid',
      eigenaar_bedrijfsnaam: 'Gemeente Amsterdam',
      eigenaar_kvk: '34366966',
      eigenaar_straat_huisnummer: 'Keizersgracht 100',
      eigenaar_postcode: '1015 CS',
      eigenaar_plaats: 'Amsterdam',
      eigenaar_verzendadres: 'Keizersgracht 100\n1015 CS Amsterdam',
      status: 'eigenaar_gevonden',
    }, uitkomst) as Record<string, unknown>;

    expect(patch.eigenaar_naam).toBe('Elisabeth Wilhelmina Cleef');
    expect(patch.eigenaar_type).toBe('particulier');
    expect(patch.eigenaar_bedrijfsnaam).toBeNull();
    expect(patch.eigenaar_kvk).toBeNull();
    expect(patch.eigenaar_straat_huisnummer).toBeNull();
    expect(patch.eigenaar_postcode).toBeNull();
    expect(patch.eigenaar_plaats).toBeNull();
    expect(patch.eigenaar_verzendadres).toBeNull();
    expect(patch.eigenaar_controle_nodig).toBe(true);
    expect(patch.status).toBe('eigenaar_achterhalen');
  });

  it('routeert een bekende eigenaar zonder postadres naar Adres achterhalen', () => {
    const readiness = bepaalSignaalReadiness({
      signaal: {
        id: 'signaal-cleef',
        status: 'eigenaar_achterhalen',
        eigenaarstatus: 'gevonden',
        eigenaar_bekend: true,
        eigenaar_naam: 'Elisabeth Wilhelmina Cleef',
        eigenaar_type: 'particulier',
        eigenaar_bedrijfsnaam: null,
        eigenaar_verzendadres: null,
        eigenaar_controle_nodig: true,
        eigenaar_controle_reden: 'Adresgegevens van de primaire rechthebbende zijn onvolledig.',
      } as any,
      brieven: [],
    });

    expect(readiness.fase).toBe('adres_ontbreekt');
    expect(readiness.info.label).toBe('Adres achterhalen');
    expect(readiness.blokkadeReden).toContain('Adresgegevens');
  });
});
