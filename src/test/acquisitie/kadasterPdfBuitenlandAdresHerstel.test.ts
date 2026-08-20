import { describe, expect, it } from 'vitest';
import { extractKadasterAdresVoorstellenUitTekst } from '../../../supabase/functions/_shared/kadasterPdfAdresParser';
import { normaliseerKadasterPdfTekst } from '../../../supabase/functions/_shared/kadasterPdfTekstNormalisatie';

describe('Kadaster PDF adresherstel — buitenlandse adressen', () => {
  it('leest een Luxemburgs adres zonder Nederlandse postcode uit het rechtenblok', () => {
    const tekst = normaliseerKadasterPdfTekst([
      'Objectinformatie',
      'Hemonystraat 66',
      '1074 BR AMSTERDAM',
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Spring Properties E S.à r.l.',
      'Adres 6C, rue Gabriel Lippmann',
      'L-5365 MUNSBACH',
      'Luxembourg',
      'Bijzonderheden',
    ].join('\n'));

    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([
      expect.objectContaining({
        bedrijfsnaam: 'Spring Properties E S.à r.l.',
        verzendadres: '6C, rue Gabriel Lippmann\nL-5365 MUNSBACH\nLuxembourg',
      }),
    ]);
  });

  it('blijft conservatief bij twee regels zonder herkenbare landregel', () => {
    const tekst = normaliseerKadasterPdfTekst([
      'Rechten',
      'Eigendom (recht van)',
      'Naam Buitenlandse Partij Ltd',
      'Adres Alleen straat 1',
      'Onbekende plaats',
      'Bijzonderheden',
    ].join('\n'));
    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([]);
  });
});
