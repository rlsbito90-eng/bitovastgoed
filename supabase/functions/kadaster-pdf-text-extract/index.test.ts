// Deno-tests voor de shared helpers van `kadaster-pdf-text-extract`.
// Geen netwerk, geen Storage, geen echte persoonsgegevens.
//
// Doel: bewijzen dat (1) normalisatie kop/voet-ruis verwijdert en kolom-
// gaps splitst, en (2) de Deno-kopie van de pure parser dezelfde voorstel-
// shape oplevert op een realistische PDF-achtige tekstinvoer.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { extractKadasterAdresVoorstellenUitTekst } from '../_shared/kadasterPdfAdresParser.ts';
import { normaliseerKadasterPdfTekst } from '../_shared/kadasterPdfTekstNormalisatie.ts';

// ─── Normalisatie ─────────────────────────────────────────────────────────

Deno.test('normaliseert: strip Kadaster kop/voet en form-feeds', () => {
  const raw = [
    'Kadaster — Eigendomsinformatie',
    'Pagina 1 van 2',
    'Objectinformatie',
    'Voorbeeldstraat 1',
    '1234 AB VOORBEELDSTAD',
    '\f',
    'Kadaster — Eigendomsinformatie',
    'Pagina 2 van 2',
    'Rechten',
    'Eigendom (recht van)',
  ].join('\n');
  const out = normaliseerKadasterPdfTekst(raw);
  assert(!out.includes('Pagina 1'));
  assert(!out.match(/^Kadaster/m));
  assert(out.includes('Objectinformatie'));
  assert(out.includes('Eigendom (recht van)'));
});

Deno.test('normaliseert: split kolom-gaps op regels met labels', () => {
  const raw = 'Aandeel 1/1    Naam Voorbeeld Persoon    Adres Voorbeeldweg 12';
  const out = normaliseerKadasterPdfTekst(raw);
  const regels = out.split('\n');
  assert(regels.some(r => r.startsWith('Aandeel')));
  assert(regels.some(r => r.startsWith('Naam')));
  assert(regels.some(r => r.startsWith('Adres')));
});

Deno.test('normaliseert: laat tekst zonder labels ongemoeid', () => {
  const raw = 'Gewone   tekst zonder labels   met dubbele spaties';
  const out = normaliseerKadasterPdfTekst(raw);
  assertEquals(out, raw.trim());
});

// ─── End-to-end: simulatie PDF-tekst → parser ─────────────────────────────

Deno.test('parser geeft voorstel op genormaliseerde PDF-achtige tekst', () => {
  const pdfTekst = [
    'Kadaster — Eigendomsinformatie',
    'Pagina 1 van 1',
    'Objectinformatie',
    'Voorbeeldstraat 1',
    '1234 AB VOORBEELDSTAD',
    '',
    'Rechten',
    'Eigendom (recht van)',
    'Aandeel 1/1    Naam Test Persoon    Adres Anderestraat 42',
    '9999 ZZ ANDEREPLAATS',
    'Bijzonderheden',
    'Geen.',
  ].join('\n');
  const tekst = normaliseerKadasterPdfTekst(pdfTekst);
  const voorstellen = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(voorstellen.length, 1);
  const v = voorstellen[0];
  assertEquals(v.naam, 'Test Persoon');
  assertEquals(v.aandeel, '1/1');
  assertEquals(v.rechtType, 'eigendom');
  assert(v.verzendadres?.includes('Anderestraat 42'));
  assert(v.verzendadres?.includes('9999 ZZ ANDEREPLAATS'));
  assertEquals(v.confidence, 'hoog');
});

Deno.test('parser herkent rechtspersoon als bedrijfsnaam', () => {
  const pdfTekst = [
    'Rechten',
    'Eigendom (recht van)',
    'Naam Voorbeeld Holding B.V.',
    'Adres Zakenlaan 7',
    '5555 AA ANDERPLAATS',
    'KvK-nummer 12345678',
    'Bijzonderheden',
  ].join('\n');
  const tekst = normaliseerKadasterPdfTekst(pdfTekst);
  const v = extractKadasterAdresVoorstellenUitTekst(tekst);
  assertEquals(v.length, 1);
  assertEquals(v[0].bedrijfsnaam, 'Voorbeeld Holding B.V.');
  assertEquals(v[0].naam, undefined);
});

Deno.test('parser geeft niets bij ontbrekend Adres-veld', () => {
  const pdfTekst = [
    'Rechten',
    'Eigendom (recht van)',
    'Naam Test Persoon',
    'Bijzonderheden',
  ].join('\n');
  const tekst = normaliseerKadasterPdfTekst(pdfTekst);
  assertEquals(extractKadasterAdresVoorstellenUitTekst(tekst).length, 0);
});
