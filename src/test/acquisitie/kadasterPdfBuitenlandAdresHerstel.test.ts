import { describe, expect, it } from 'vitest';
import { extractKadasterAdresVoorstellenUitTekst } from '../../../supabase/functions/_shared/kadasterPdfAdresParser';
import { normaliseerKadasterPdfTekst } from '../../../supabase/functions/_shared/kadasterPdfTekstNormalisatie';

describe('Kadaster PDF adresherstel — buitenlandse adressen', () => {
  it('leest een Luxemburgs adres met expliciete landregel uit het rechtenblok', () => {
    const tekst = normaliseerKadasterPdfTekst([
      'Objectinformatie',
      'Hemonystraat 66',
      '1074 BR AMSTERDAM',
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Spring Properties E S.à r.l.',
      'Adres 1, Allée Scheffer',
      'L-2520 LUXEMBOURG',
      'Luxembourg',
      'Bijzonderheden',
    ].join('\n'));

    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([
      expect.objectContaining({
        bedrijfsnaam: 'Spring Properties E S.à r.l.',
        verzendadres: '1, Allée Scheffer\nL-2520 LUXEMBOURG\nLuxembourg',
      }),
    ]);
  });

  it('vult bij een tweeregelig L-#### adres uitsluitend de Luxemburg-landregel aan', () => {
    const tekst = normaliseerKadasterPdfTekst([
      'Rechten',
      'Eigendom (recht van)',
      'Naam Spring Properties E S.à r.l.',
      'Adres 1, Allée Scheffer',
      'L-2520 LUXEMBOURG',
      'Bijzonderheden',
    ].join('\n'));

    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([
      expect.objectContaining({
        bedrijfsnaam: 'Spring Properties E S.à r.l.',
        verzendadres: '1, Allée Scheffer\nL-2520 LUXEMBOURG\nLuxembourg',
      }),
    ]);
  });

  it('blijft conservatief bij twee regels zonder herkenbare land- of landcode', () => {
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
