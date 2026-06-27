// Tests voor de privacy-veilige maskeer-helper.
// Geen echte persoonsgegevens.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { maskeerPdfDebugTekst, maskeerEersteRegels } from '../_shared/kadasterPdfTekstMasker.ts';

Deno.test('maskeer: cijfers worden 9', () => {
  assertEquals(maskeerPdfDebugTekst('12345'), '99999');
  assertEquals(maskeerPdfDebugTekst('Geboren 01-02-1980'), 'Geboren 99-99-9999');
});

Deno.test('maskeer: persoonsnaam wordt onleesbaar, label blijft', () => {
  const uit = maskeerPdfDebugTekst('Naam Voorbeeld Persoon');
  assertEquals(uit, 'Naam xxxxxxxxx xxxxxxx');
});

Deno.test('maskeer: adres en postcode worden onleesbaar', () => {
  assertEquals(maskeerPdfDebugTekst('Adres Voorbeeldstraat 12'), 'Adres xxxxxxxxxxxxxxxx 99');
  assertEquals(maskeerPdfDebugTekst('1017 AB AMSTERDAM'), '9999 xx xxxxxxxxx');
});

Deno.test('maskeer: structuurwoorden blijven leesbaar', () => {
  const uit = maskeerPdfDebugTekst('Rechten Eigendom recht van Aandeel');
  assertEquals(uit, 'Rechten Eigendom recht van Aandeel');
});

Deno.test('maskeer: regelovergangen blijven behouden', () => {
  const input = 'Naam Iemand\nAdres Straat 1\n1234 AB STAD';
  const uit = maskeerPdfDebugTekst(input);
  const regels = uit.split('\n');
  assertEquals(regels.length, 3);
  assert(regels[0].startsWith('Naam '));
  assert(regels[1].startsWith('Adres '));
  assertEquals(regels[2], '9999 xx xxxx');
});

Deno.test('maskeer: bevat geen leesbare persoonsgegevens', () => {
  const uit = maskeerPdfDebugTekst('Jan Jansen, geboren 01-01-1970 te Amsterdam, Hoofdstraat 12');
  assert(!uit.includes('Jansen'));
  assert(!uit.includes('Amsterdam'));
  assert(!uit.includes('Hoofdstraat'));
  assert(!uit.includes('1970'));
});

Deno.test('eerste_40_regels: limiteert tot max', () => {
  const input = Array.from({ length: 100 }, (_, i) => `regel ${i}`).join('\n');
  const out = maskeerEersteRegels(input, 40);
  assertEquals(out.length, 40);
});
