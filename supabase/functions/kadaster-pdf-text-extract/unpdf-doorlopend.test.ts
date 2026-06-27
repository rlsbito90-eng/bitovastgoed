// Deno-tests: normalisatie + parser op doorlopende `unpdf`-achtige tekst.
// Geen netwerk, geen Storage, geen echte persoonsgegevens.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { extractKadasterAdresVoorstellenUitTekst } from '../_shared/kadasterPdfAdresParser.ts';
import { normaliseerKadasterPdfTekst } from '../_shared/kadasterPdfTekstNormalisatie.ts';

// 1) Eén natuurlijke persoon — objectadres bovenaan, "Rechten & aantekeningen"
//    voor de echte rechtensectie. Verwacht 1 voorstel met EIGENAARSADRES.
Deno.test('unpdf-doorlopend: één persoon, eigenaarsadres ≠ objectadres', () => {
  const raw =
    'Objectinformatie Adres Voorbeeldstraat 1 1234 AB VOORBEELDSTAD ' +
    'Algemeen iets iets ' +
    'Kadastrale kaart blabla ' +
    'Actualiteitsinformatie 01-01-2024 ' +
    'Rechten & aantekeningen 01-01-2024 ' +
    'Rechten Eigendom (recht van) Aandeel 1/1 Naam Test Persoon ' +
    'Geboren 01-01-1970 te Geboorteplaats ' +
    'Adres Anderestraat 42 9999 ZZ ANDEREPLAATS ' +
    'Gebaseerd op Register Hyp4 Deel 12345 nummer 67 ' +
    'Bijzonderheden Geen.';
  const tekst = normaliseerKadasterPdfTekst(raw);
  const v = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(v.length, 1);
  assertEquals(v[0].naam, 'Test Persoon');
  assertEquals(v[0].aandeel, '1/1');
  assertEquals(v[0].rechtType, 'eigendom');
  assert(v[0].verzendadres?.includes('Anderestraat 42'));
  assert(v[0].verzendadres?.includes('9999 ZZ ANDEREPLAATS'));
  assert(!v[0].verzendadres?.includes('Voorbeeldstraat'));
});

// 2) "Rechten & aantekeningen" zonder echte "Rechten"-sectie → 0 voorstellen.
Deno.test('unpdf-doorlopend: "Rechten & aantekeningen" telt niet als rechtensectie', () => {
  const raw =
    'Objectinformatie Adres Voorbeeldstraat 1 1234 AB VOORBEELDSTAD ' +
    'Algemeen ... Actualiteitsinformatie ... ' +
    'Rechten & aantekeningen 01-01-2024 Geen relevante aantekeningen. ' +
    'Bijzonderheden Geen.';
  const tekst = normaliseerKadasterPdfTekst(raw);
  const v = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(v.length, 0);
});

// 3) Twee rechthebbenden — adressen niet verwisseld.
Deno.test('unpdf-doorlopend: twee rechthebbenden, twee voorstellen', () => {
  const raw =
    'Objectinformatie Adres Voorbeeldstraat 1 1234 AB VOORBEELDSTAD ' +
    'Rechten & aantekeningen 01-01-2024 ' +
    'Rechten Eigendom (recht van) Aandeel 1/2 Naam Persoon Een ' +
    'Adres Eenstraat 1 1111 AA EENSTAD ' +
    'Gebaseerd op Register Hyp4 Deel 1 nummer 1 ' +
    'Eigendom (recht van) Aandeel 1/2 Naam Persoon Twee ' +
    'Adres Tweestraat 2 2222 BB TWEESTAD ' +
    'Gebaseerd op Register Hyp4 Deel 2 nummer 2 ' +
    'Bijzonderheden Geen.';
  const tekst = normaliseerKadasterPdfTekst(raw);
  const v = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(v.length, 2);
  assertEquals(v[0].naam, 'Persoon Een');
  assert(v[0].verzendadres?.includes('Eenstraat 1'));
  assert(v[0].verzendadres?.includes('1111 AA EENSTAD'));
  assertEquals(v[1].naam, 'Persoon Twee');
  assert(v[1].verzendadres?.includes('Tweestraat 2'));
  assert(v[1].verzendadres?.includes('2222 BB TWEESTAD'));
});

// 4) Rechtspersoon / B.V. → bedrijfsnaam.
Deno.test('unpdf-doorlopend: B.V. wordt bedrijfsnaam', () => {
  const raw =
    'Objectinformatie Adres Voorbeeldstraat 1 1234 AB VOORBEELDSTAD ' +
    'Rechten & aantekeningen 01-01-2024 ' +
    'Rechten Eigendom (recht van) Aandeel 1/1 Naam Voorbeeld Holding B.V. ' +
    'Zetel Voorbeeldstad KvK-nummer 12345678 ' +
    'Adres Zakenlaan 7 5555 AA ANDERPLAATS ' +
    'Gebaseerd op Register Hyp4 Deel 1 nummer 1 ' +
    'Bijzonderheden Geen.';
  const tekst = normaliseerKadasterPdfTekst(raw);
  const v = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(v.length, 1);
  assertEquals(v[0].bedrijfsnaam, 'Voorbeeld Holding B.V.');
  assertEquals(v[0].naam, undefined);
  assert(v[0].verzendadres?.includes('Zakenlaan 7'));
});

// 5) Alleen objectadres, geen rechten-sectie → 0 voorstellen.
Deno.test('unpdf-doorlopend: alleen objectadres → 0 voorstellen', () => {
  const raw =
    'Objectinformatie Adres Voorbeeldstraat 1 1234 AB VOORBEELDSTAD ' +
    'Algemeen ... Kadastrale kaart ... Actualiteitsinformatie ... ' +
    'Bijzonderheden Geen.';
  const tekst = normaliseerKadasterPdfTekst(raw);
  const v = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(v.length, 0);
});

// 6) Splitsing bewijst kale "Rechten" en "Rechten & aantekeningen" gescheiden.
Deno.test('unpdf-doorlopend: kale "Rechten" en "Rechten & aantekeningen" staan op aparte regels', () => {
  const raw =
    'Actualiteitsinformatie iets Rechten & aantekeningen 01-01-2024 Rechten Eigendom (recht van) Aandeel 1/1';
  const tekst = normaliseerKadasterPdfTekst(raw);
  const regels = tekst.split('\n').map(r => r.trim());
  assert(regels.includes('Rechten'));
  assert(regels.some(r => r.startsWith('Rechten & aantekeningen')));
  assert(regels.some(r => r.startsWith('Eigendom (recht van)')));
});
