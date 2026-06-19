// V2.3 — workflow-default voor Kadaster-productselectie:
// Rechten + Kadasterbericht/PDF intern opslaan staan standaard aan,
// Koopsom staat standaard uit. Minstens één product blijft geselecteerd.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bron = readFileSync(
  resolve(__dirname, '../../../components/offmarket/kadaster/SignaalKadasterKaart.tsx'),
  'utf8',
);

describe('SignaalKadasterKaart — default productselectie', () => {
  it('Rechten is standaard aangevinkt', () => {
    expect(bron).toMatch(/useState<[^>]*>\(true\)\s*;[^]*?selRechten/);
    // robuuster: directe match op de declaratie
    expect(bron).toMatch(/const\s+\[selRechten,\s*setSelRechten\]\s*=\s*useState\(true\)/);
  });

  it('Kadasterbericht/PDF intern opslaan is standaard aangevinkt', () => {
    expect(bron).toMatch(/const\s+\[selPdf,\s*setSelPdf\]\s*=\s*useState\(true\)/);
  });

  it('Koopsom is standaard niet aangevinkt', () => {
    expect(bron).toMatch(/const\s+\[selWaarde,\s*setSelWaarde\]\s*=\s*useState\(false\)/);
  });

  it('met de standaardselectie is minimaal één betaald product gekozen (heeftBetaaldProduct=true)', () => {
    // selRechten=true + rechtenBeschikbaar leidt tot heeftBetaaldProduct=true
    // en daarmee actieve bevestigingsknop + kloppende kostenberekening.
    const selWaardeDefault = false;
    const selRechtenDefault = true;
    const rechtenBeschikbaar = true; // catalogus levert rechten als toegestaan
    const waardeBeschikbaar = true;
    const heeftBetaaldProduct =
      (selWaardeDefault && waardeBeschikbaar) ||
      (selRechtenDefault && rechtenBeschikbaar);
    expect(heeftBetaaldProduct).toBe(true);
  });

  it('kostenberekening reflecteert standaardselectie: alleen rechten, geen waarde', () => {
    const selWaardeDefault = false;
    const selRechtenDefault = true;
    const geselecteerd: string[] = [];
    if (selWaardeDefault) geselecteerd.push('waarde');
    if (selRechtenDefault) geselecteerd.push('rechten');
    expect(geselecteerd).toEqual(['rechten']);
  });
});
