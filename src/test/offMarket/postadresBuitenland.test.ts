// Regressietests voor buitenlandse verzendadressen in de Off-Market
// Acquisitieselectie. Voedt gelijktijdig de centrale postadresvalidatie,
// de readiness-fase, de bulkkandidaat-geschiktheid en de Brother-parser.
import { describe, it, expect } from 'vitest';
import {
  parsePostadres,
  isVolledigPostadres,
} from '@/lib/offMarket/acquisitie/postadres';
import {
  isVolledigPostadres as isVolledigPostadresReadiness,
  bepaalSignaalReadiness,
  geadresseerdenVoorSignaal,
} from '@/lib/offMarket/acquisitie/readiness';
import { bouwKandidatenVoorSignaal } from '@/lib/offMarket/acquisitie/bulkBrief';
import {
  parseVerzendadresBrother,
  bouwBrotherLabelRij,
  type BrotherBrief,
} from '@/lib/offMarket/acquisitie/brotherCsv';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

// ---------------------------------------------------------------------
// A. Centrale validatie
// ---------------------------------------------------------------------
describe('postadres — centrale volledigheidsregels', () => {
  const IT = 'Strada Favona IV 1\n72012 CAROVIGNO\nItalië';
  const PT = 'Ru Poeta Emiliano da Costa n. 82 RC\n8800-357 TAVIRA\nPortugal';

  it('1. geldig Nederlands adres → true', () => {
    expect(isVolledigPostadres('Straat 1\n1234 AB Plaats')).toBe(true);
  });
  it('2. Italiaans voorbeeldadres → true', () => {
    expect(isVolledigPostadres(IT)).toBe(true);
  });
  it('3. Portugees voorbeeldadres → true', () => {
    expect(isVolledigPostadres(PT)).toBe(true);
  });
  it('4. Buitenlandse alfanumerieke postcode → true', () => {
    expect(isVolledigPostadres('221B Baker Street\nNW1 6XE London\nEngeland'))
      .toBe(true);
    expect(isVolledigPostadres('10 Rue de Rivoli\n75001 Paris\nFrankrijk'))
      .toBe(true);
  });
  it('5. leeg adres → false', () => {
    expect(isVolledigPostadres(null)).toBe(false);
    expect(isVolledigPostadres('')).toBe(false);
    expect(isVolledigPostadres('   \n  \n')).toBe(false);
  });
  it('6. één regel → false', () => {
    expect(isVolledigPostadres('Alleen straatnaam 1')).toBe(false);
  });
  it('7. straat zonder postcode/plaats en land → false', () => {
    expect(isVolledigPostadres('Straat 1')).toBe(false);
    expect(isVolledigPostadres('Straat 1\n')).toBe(false);
  });
  it('8. twee regels zonder NL-postcode en zonder land → false', () => {
    expect(isVolledigPostadres('Straat 1\nMilano')).toBe(false);
    expect(isVolledigPostadres('Straat 1\n72012 Milano')).toBe(false);
  });
  it('9. postcode/plaats + land zonder straat → false', () => {
    expect(isVolledigPostadres('72012 CAROVIGNO\nItalië')).toBe(false);
    expect(isVolledigPostadres('1234 AB Plaats\nNederland')).toBe(false);
  });
  it('10. placeholderwaarden → false', () => {
    expect(isVolledigPostadres('onbekend')).toBe(false);
    expect(isVolledigPostadres('n.v.t.\n-\nonbekend')).toBe(false);
    expect(isVolledigPostadres('geen\ngeen\ngeen')).toBe(false);
  });
  it('landregel met cijfers wordt niet als land geaccepteerd', () => {
    // Drie regels, laatste bevat een cijfer → geen herkenbare landregel.
    expect(isVolledigPostadres('Straat 1\n1234 Plaats\n99 Extra')).toBe(false);
  });
  it('NL is niet gelijk aan buitenland, ook al zijn er 3 regels', () => {
    // "Nederland" als laatste regel — nog steeds NL; wordt via NL-pad
    // beoordeeld en volledig alleen wanneer NL-postcode aanwezig is.
    expect(isVolledigPostadres('Straat 1\n1234 AB Plaats\nNederland'))
      .toBe(true);
    expect(isVolledigPostadres('Straat 1\nPlaats\nNederland')).toBe(false);
  });
  it('parser retourneert correcte structuur voor Italië', () => {
    const p = parsePostadres(IT);
    expect(p?.isBuitenland).toBe(true);
    expect(p?.land).toBe('Italië');
    expect(p?.straat).toBe('Strada Favona IV 1');
    expect(p?.postcodePlaats).toBe('72012 CAROVIGNO');
  });
  it('parser retourneert correcte structuur voor Portugal', () => {
    const p = parsePostadres(PT);
    expect(p?.isBuitenland).toBe(true);
    expect(p?.land).toBe('Portugal');
    expect(p?.postcodePlaats).toBe('8800-357 TAVIRA');
  });
  it('readiness-export isVolledigPostadres delegeert aan centrale parser', () => {
    expect(isVolledigPostadresReadiness('Strada Favona IV 1\n72012 CAROVIGNO\nItalië'))
      .toBe(true);
  });
});

// ---------------------------------------------------------------------
// Fixtures voor readiness + bulkBrief
// ---------------------------------------------------------------------
function maakSignaal(over?: Partial<OffMarketSignaal>): OffMarketSignaal {
  return {
    id: 'sig-1',
    titel: 'Test signaal',
    status: 'te_beoordelen',
    updated_at: '2026-07-01T00:00:00Z',
    created_at: '2026-07-01T00:00:00Z',
    ...(over as object),
  } as unknown as OffMarketSignaal;
}

function maakBrief(over?: Partial<OffMarketBrief>): OffMarketBrief {
  return {
    id: 'b-1',
    signaal_id: 'sig-1',
    eigenaar_naam: 'J.B. Labeij',
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Strada Favona IV 1\n72012 CAROVIGNO\nItalië',
    aanhef: null,
    kanaal: 'post',
    status: 'concept',
    verzendstatus: 'concept',
    campagne_stap: null,
    geadresseerde_key: null,
    updated_at: '2026-07-01T00:00:00Z',
    created_at: '2026-07-01T00:00:00Z',
    archived_at: null,
    ...(over as object),
  } as unknown as OffMarketBrief;
}

// ---------------------------------------------------------------------
// B. Readiness
// ---------------------------------------------------------------------
describe('readiness — buitenlands adres doorwerking', () => {
  it('11. Buitenlands conceptbrief + naam + volledig adres → gereed_voor_print', () => {
    const s = maakSignaal();
    const b = maakBrief();
    const r = bepaalSignaalReadiness({ signaal: s, brieven: [b] });
    expect(r.fase).toBe('gereed_voor_print');
    expect(r.geadresseerden[0]?.volledigPostadres).toBe(true);
    expect(r.telling.gereedVoorPrint).toBe(1);
  });

  it('12. Onvolledig buitenlands adres → concept_gereed, niet printklaar', () => {
    const s = maakSignaal();
    const b = maakBrief({ verzendadres: 'Strada Favona IV 1\nItalië' });
    const r = bepaalSignaalReadiness({ signaal: s, brieven: [b] });
    expect(r.fase).toBe('concept_gereed');
    expect(r.geadresseerden[0]?.volledigPostadres).toBe(false);
    expect(r.telling.gereedVoorPrint).toBe(0);
  });

  it('geadresseerdenVoorSignaal detecteert volledig buitenlands adres', () => {
    const g = geadresseerdenVoorSignaal(maakSignaal(), [maakBrief()]);
    expect(g).toHaveLength(1);
    expect(g[0].volledigPostadres).toBe(true);
  });
});

// ---------------------------------------------------------------------
// C. Bulkselectie
// ---------------------------------------------------------------------
describe('bulkBrief — bulkkandidaat-geschiktheid voor buitenland', () => {
  it('13. Volledige buitenlandse conceptbrief → geschikt=true, geen blokkade', () => {
    const s = maakSignaal();
    const b = maakBrief();
    const kandidaten = bouwKandidatenVoorSignaal(s, [b]);
    // Verwacht minimaal één kandidaat voor deze geadresseerde.
    const k = kandidaten.find((x: any) =>
      (x.eigenaarNaam ?? x.geadresseerdeLabel ?? '').includes('Labeij')
    ) ?? kandidaten[0];
    expect(k).toBeDefined();
    expect((k as any).geschikt).toBe(true);
    expect((k as any).blokkade ?? null).toBeNull();
  });

  it('14. Onvolledige buitenlandse conceptbrief → geblokkeerd op postadres', () => {
    const s = maakSignaal();
    const b = maakBrief({ verzendadres: 'Strada Favona IV 1\nItalië' });
    const kandidaten = bouwKandidatenVoorSignaal(s, [b]);
    const k = kandidaten[0];
    expect(k).toBeDefined();
    expect((k as any).geschikt).toBe(false);
    expect(String((k as any).blokkade ?? '')).toMatch(/postadres/i);
  });
});

// ---------------------------------------------------------------------
// D. Brother-integratie
// ---------------------------------------------------------------------
describe('brotherCsv — buitenlandse adressen via gedeelde parser', () => {
  function brief(p: Partial<BrotherBrief> & { id: string }): BrotherBrief {
    return {
      id: p.id,
      eigenaar_naam: null,
      eigenaar_bedrijfsnaam: null,
      verzendadres: null,
      aanhef: null,
      ...p,
    };
  }

  it('15. J.B. Labeij (Italië) → straat / postcode+plaats / land correct', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'labeij',
      eigenaar_naam: 'J.B. Labeij',
      verzendadres: 'Strada Favona IV 1\n72012 CAROVIGNO\nItalië',
    }), 1);
    expect(r.geldig).toBe(true);
    expect(r.regel2).toBe('Strada Favona IV 1');
    expect(r.regel3).toBe('72012 CAROVIGNO');
    expect(r.regel4).toBe('Italië');
  });

  it('16. M. Paare (Portugal) → straat / postcode+plaats / land correct', () => {
    const r = bouwBrotherLabelRij(brief({
      id: 'paare',
      eigenaar_naam: 'M. Paare',
      verzendadres:
        'Ru Poeta Emiliano da Costa n. 82 RC\n8800-357 TAVIRA\nPortugal',
    }), 1);
    expect(r.geldig).toBe(true);
    expect(r.regel2).toBe('Ru Poeta Emiliano da Costa n. 82 RC');
    expect(r.regel3).toBe('8800-357 TAVIRA');
    expect(r.regel4).toBe('Portugal');
  });

  it('17. parseVerzendadresBrother houdt buitenland-shape gelijk', () => {
    const a = parseVerzendadresBrother(
      'Strada Favona IV 1\n72012 CAROVIGNO\nItalië',
    );
    expect(a).toEqual({
      straat: 'Strada Favona IV 1',
      postcodePlaats: '72012 CAROVIGNO',
      land: 'Italië',
    });
  });

  it('18. NL-parsing blijft identiek werken (regressie)', () => {
    const a = parseVerzendadresBrother('Straat 1\n1000ab utrecht');
    expect(a).toEqual({
      straat: 'Straat 1',
      postcodePlaats: '1000 AB UTRECHT',
      land: null,
    });
  });
});
