// Tests voor `extractKadasterAdresVoorstellenUitTekst` — pure parser
// op fictieve/geanonimiseerde Kadasterbericht-tekstfixtures.
//
// Privacy: ALLE namen, bedrijven, adressen en gemeenten zijn fictief.
import { describe, it, expect } from 'vitest';
import {
  extractKadasterAdresVoorstellenUitTekst,
} from '@/lib/kadaster/kadasterPdfAdresParser';

describe('extractKadasterAdresVoorstellenUitTekst', () => {
  it('1) natuurlijk persoon: alleen eigenaarsadres, niet objectadres', () => {
    const tekst = [
      'Objectinformatie',
      '',
      'Fictiefstraat 49',
      '1000AA',
      'Teststad',
      '',
      'Algemeen',
      'Kadastrale aanduiding Teststad A 1234',
      '',
      'Rechten',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Jan Voorbeeld',
      'Geboren 01-01-1970',
      'te Teststad',
      'Adres Andersweg 12',
      '2000BB',
      'ANDERSTAD',
      'Gebaseerd op Register Hyp4 Deel 1 nummer 1',
      '',
      'Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(1);
    expect(r[0].naam).toBe('Jan Voorbeeld');
    expect(r[0].bedrijfsnaam).toBeUndefined();
    expect(r[0].verzendadres).toBe('Andersweg 12\n2000 BB ANDERSTAD');
    expect(r[0].rechtType).toBe('eigendom');
    expect(r[0].aandeel).toBe('1/1');
    expect(r[0].verzendadres).not.toContain('Fictiefstraat');
  });

  it('2) rechtspersoon/B.V.: bedrijfsnaam + verzendadres, niet als persoon', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 26-A',
      '1000AA',
      'Teststad',
      '',
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1 Naam Voorbeeld & Partner B.V. Adres Bedrijfsweg 119 3000CC ANDERSTAD Postbus - Zetel ANDERSTAD KvK-nummer 12345678 (Bron: Handelsregister) Gebaseerd op Register Hyp4 Deel 9 nummer 9',
      '',
      'Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(1);
    expect(r[0].bedrijfsnaam).toBe('Voorbeeld & Partner B.V.');
    expect(r[0].naam).toBeUndefined();
    expect(r[0].verzendadres).toBe('Bedrijfsweg 119\n3000 CC ANDERSTAD');
    expect(r[0].rechtType).toBe('eigendom');
    expect(r[0].aandeel).toBe('1/1');
  });

  it('3) meerdere rechthebbenden met verschillende adressen → aparte voorstellen', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 100',
      '1000AA Teststad',
      '',
      'Rechten',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/2',
      'Naam Anna Voorbeeld',
      'Adres Eikenlaan 3',
      '2000BB ANDERSTAD',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/2',
      'Naam Bart Voorbeeld',
      'Adres Beukenlaan 4',
      '3000CC DERDESTAD',
      '',
      'Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(2);
    expect(r[0].naam).toBe('Anna Voorbeeld');
    expect(r[0].verzendadres).toBe('Eikenlaan 3\n2000 BB ANDERSTAD');
    expect(r[1].naam).toBe('Bart Voorbeeld');
    expect(r[1].verzendadres).toBe('Beukenlaan 4\n3000 CC DERDESTAD');
  });

  it('4) alleen objectadres aanwezig, geen eigenaaradres → lege array', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 7',
      '1000AA Teststad',
      '',
      'Algemeen',
      'Kadastrale aanduiding Teststad A 1',
      '',
      'Bijzonderheden',
    ].join('\n');

    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([]);
  });

  it('5) onzekere/onbruikbare structuur → lege array', () => {
    const tekst = 'Wat losse tekst zonder enige rubriek of rechtenblok.';
    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([]);
    expect(extractKadasterAdresVoorstellenUitTekst('')).toEqual([]);
    expect(extractKadasterAdresVoorstellenUitTekst(null as unknown as string)).toEqual([]);
  });

  it('6) objectadres en eigenaarsadres lijken qua formaat — alleen het adres onder rubriek wordt geretourneerd', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 1',
      '1000AA Teststad',
      '',
      // Geen rechten-sectie: ook al lijkt het op een adres, niets retourneren.
      'Algemeen',
      'Kadastrale aanduiding Teststad A 5',
      '',
      'Bijzonderheden',
    ].join('\n');
    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([]);

    // Variant met rechten-sectie: rubriek bepaalt, niet het patroon.
    const metRechten = [
      'Objectinformatie',
      'Fictiefstraat 1',
      '1000AA Teststad',
      '',
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Carla Voorbeeld',
      'Adres Tweedeweg 9',
      '2000BB ANDERSTAD',
      '',
      'Bijzonderheden',
    ].join('\n');
    const r = extractKadasterAdresVoorstellenUitTekst(metRechten);
    expect(r).toHaveLength(1);
    expect(r[0].verzendadres).toBe('Tweedeweg 9\n2000 BB ANDERSTAD');
    expect(r[0].verzendadres).not.toContain('Fictiefstraat');
  });

  it('7) erfpacht-fixture: bloot eigenaar + erfpachter blijven gescheiden', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 9-H',
      '1000AA Teststad',
      '',
      'Rechten',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Gemeente Fictiefstad',
      'Adres Plein 1',
      '1000AA TESTSTAD',
      'Postbus 1100',
      '1099BC TESTSTAD',
      'Zetel TESTSTAD',
      'KvK-nummer 11112222 (Bron: Handelsregister)',
      '',
      'Overige rechten',
      '',
      'Erfpacht (recht van)',
      'Aandeel 1/1',
      'Naam Fictief Vastgoed B.V.',
      'Adres Beleggerslaan 314',
      '2000BB ANDERSTAD',
      'Postbus -',
      'Zetel DERDESTAD',
      'KvK-nummer 33334444 (Bron: Handelsregister)',
      'Gebaseerd op Register Hyp4 Deel 9 nummer 2',
      '',
      'Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(2);

    const eig = r.find(v => v.rechtType === 'eigendom')!;
    const erf = r.find(v => v.rechtType === 'erfpacht')!;
    expect(eig).toBeDefined();
    expect(erf).toBeDefined();

    expect(eig.bedrijfsnaam).toBe('Gemeente Fictiefstad');
    expect(eig.verzendadres).toBe('Plein 1\n1000 AA TESTSTAD');
    expect(eig.rolLabel).toBe('Eigendom (recht van)');

    expect(erf.bedrijfsnaam).toBe('Fictief Vastgoed B.V.');
    expect(erf.verzendadres).toBe('Beleggerslaan 314\n2000 BB ANDERSTAD');
    expect(erf.rolLabel).toBe('Erfpacht (recht van)');

    // Objectadres "Fictiefstraat 9-H" mag niet voorkomen.
    for (const v of r) {
      expect(v.verzendadres).not.toContain('Fictiefstraat');
    }
  });

  it('8) meerdere eigenaren met zelfde achternaam: ieder eigen aandeel en adres', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 100-H',
      '1000AA Teststad',
      '',
      'Rechten',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/4',
      'Naam Alexandra Voorbeeld',
      'Geboren 01-01-1990',
      'te ANDERSTAD',
      'Adres Eikenlaan 57-3',
      '2000BB ANDERSTAD',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/4',
      'Naam Catharina Voorbeeld',
      'Geboren 02-02-1992',
      'te ANDERSTAD',
      'Adres Beukenlaan 20-B',
      '3000CC DERDESTAD',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/4',
      'Naam Floris Voorbeeld',
      'Geboren 03-03-1994',
      'te ANDERSTAD',
      'Adres Lindenlaan 22',
      '4000DD VIERDESTAD',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/4',
      'Naam Willem Voorbeeld',
      'Geboren 04-04-1996',
      'te ANDERSTAD',
      'Adres Fictiefstraat 100-H',
      '1000AA TESTSTAD',
      '',
      'Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(4);
    expect(r.map(v => v.naam)).toEqual([
      'Alexandra Voorbeeld', 'Catharina Voorbeeld', 'Floris Voorbeeld', 'Willem Voorbeeld',
    ]);
    for (const v of r) {
      expect(v.aandeel).toBe('1/4');
      expect(v.rechtType).toBe('eigendom');
    }
    expect(r[0].verzendadres).toBe('Eikenlaan 57-3\n2000 BB ANDERSTAD');
    expect(r[1].verzendadres).toBe('Beukenlaan 20-B\n3000 CC DERDESTAD');
    expect(r[2].verzendadres).toBe('Lindenlaan 22\n4000 DD VIERDESTAD');
    expect(r[3].verzendadres).toBe('Fictiefstraat 100-H\n1000 AA TESTSTAD');
  });

  it('9) eigenaar woont op objectadres: voorstel toegestaan met reden + middel-confidence', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 100-H',
      '1000AA Teststad',
      '',
      'Rechten',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Willem Voorbeeld',
      'Adres Fictiefstraat 100-H',
      '1000AA TESTSTAD',
      '',
      'Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(1);
    expect(r[0].naam).toBe('Willem Voorbeeld');
    expect(r[0].verzendadres).toBe('Fictiefstraat 100-H\n1000 AA TESTSTAD');
    expect(r[0].confidence).toBe('middel');
    expect(r[0].reden).toContain('Adres staat binnen eigenaarblok en is gelijk aan objectadres');
    expect(r[0].reden).toContain('Eigendom (recht van)');
  });

  it('10) gedeeld adres bij meerdere rechthebbenden onder duidelijke rubriek → aparte voorstellen', () => {
    const tekst = [
      'Objectinformatie',
      'Fictiefstraat 5',
      '1000AA Teststad',
      '',
      'Rechten',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/2',
      'Naam Anna Voorbeeld',
      'Adres Samenweg 8',
      '2000BB ANDERSTAD',
      '',
      'Eigendom (recht van)',
      'Aandeel 1/2',
      'Naam Bart Voorbeeld',
      'Adres Samenweg 8',
      '2000BB ANDERSTAD',
      '',
      'Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(2);
    expect(r[0].naam).toBe('Anna Voorbeeld');
    expect(r[1].naam).toBe('Bart Voorbeeld');
    expect(r[0].verzendadres).toBe('Samenweg 8\n2000 BB ANDERSTAD');
    expect(r[1].verzendadres).toBe(r[0].verzendadres);
    expect(r[0].aandeel).toBe('1/2');
    expect(r[1].aandeel).toBe('1/2');
  });

  it('robuust: markdown-formattering (**bold** / # headers) wordt afgepeld', () => {
    const tekst = [
      '# Objectinformatie',
      '',
      'Fictiefstraat 1',
      '1000AA Teststad',
      '',
      '## Rechten',
      '',
      '## Eigendom (recht van)',
      '**Aandeel:** 1/1',
      '**Naam:** Test Voorbeeld B.V.',
      '**Adres:** Weg 1',
      '2000BB ANDERSTAD',
      '',
      '## Bijzonderheden',
    ].join('\n');

    const r = extractKadasterAdresVoorstellenUitTekst(tekst);
    expect(r).toHaveLength(1);
    expect(r[0].bedrijfsnaam).toBe('Test Voorbeeld B.V.');
    expect(r[0].verzendadres).toBe('Weg 1\n2000 BB ANDERSTAD');
  });

  it('adres met "-" of "Onbekend" levert geen voorstel op', () => {
    const tekst = [
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Niemand Voorbeeld',
      'Adres -',
      'Bijzonderheden',
    ].join('\n');
    expect(extractKadasterAdresVoorstellenUitTekst(tekst)).toEqual([]);
  });
});
