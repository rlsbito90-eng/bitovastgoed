// Deno-tests voor compacte rechtspersoon-adressen + Postbus-fallback.
// Geen netwerk, geen Storage. Privacy: fictieve/zelf gegenereerde gegevens.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractKadasterAdresVoorstellenUitTekst } from '../_shared/kadasterPdfAdresParser.ts';

Deno.test('compact: rechtspersoon met aaneengeplakt straat+huisnr en postcode', () => {
  const tekst = [
    'Rechten',
    'Eigendom (recht van)',
    'Aandeel 1/1',
    'Naam MargaHoldingB.V.',
    'Adres Pontsteiger103',
    '1014ZP',
    'AMSTERDAM',
    'Postbus -',
    'Zetel ZANDVOORT',
    'KvK-nummer 34096119',
    'Bijzonderheden',
  ].join('\n');
  const r = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(r.length, 1);
  assertEquals(r[0].bedrijfsnaam, 'MargaHoldingB.V.');
  assertEquals(r[0].verzendadres, 'Pontsteiger 103\n1014 ZP AMSTERDAM');
});

Deno.test('compact: huisnummer met toevoeging Lindengracht227-1', () => {
  const tekst = [
    'Rechten',
    'Eigendom (recht van)',
    'Aandeel 1/1',
    'Naam Voorbeeld B.V.',
    'Adres Lindengracht227-1',
    '1015KE AMSTERDAM',
    'KvK-nummer 99999999',
    'Bijzonderheden',
  ].join('\n');
  const r = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(r.length, 1);
  assertEquals(r[0].verzendadres, 'Lindengracht 227-1\n1015 KE AMSTERDAM');
});

Deno.test('Postbus-fallback wanneer geen Adres-blok aanwezig', () => {
  const tekst = [
    'Rechten',
    'Eigendom (recht van)',
    'Aandeel 1/1',
    'Naam Voorbeeld Stichting',
    'Postbus 1234',
    '5678AB ANDERSTAD',
    'Zetel ANDERSTAD',
    'KvK-nummer 11112222',
    'Bijzonderheden',
  ].join('\n');
  const r = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(r.length, 1);
  assertEquals(r[0].bedrijfsnaam, 'Voorbeeld Stichting');
  assertEquals(r[0].verzendadres, 'Postbus 1234\n5678 AB ANDERSTAD');
});

Deno.test('alleen Zetel + KvK → geen voorstel (Zetel nooit als adres)', () => {
  const tekst = [
    'Rechten',
    'Eigendom (recht van)',
    'Aandeel 1/1',
    'Naam Geen Adres B.V.',
    'Postbus -',
    'Zetel AMSTERDAM',
    'KvK-nummer 12345678',
    'Bijzonderheden',
  ].join('\n');
  const r = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(r.length, 0);
  assert(true);
});
