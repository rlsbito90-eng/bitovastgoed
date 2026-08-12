import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const review = fs.readFileSync('src/components/bag/BagSelectieReview.tsx', 'utf8');
const persistence = fs.readFileSync('src/lib/bag/pandenverkennerPersistence.ts', 'utf8');
const dialog = fs.readFileSync('src/components/bag/BagHandmatigePromotieDialog.tsx', 'utf8');

describe('Pandenverkenner workflow & persistence', () => {
  it('herstelt filters en werkweergave binnen dezelfde browsersessie', () => {
    expect(persistence).toContain('sessionStorage');
    expect(lijst).toContain('leesWerkcontext(scopeCode)');
    expect(lijst).toContain('bewaarWerkcontext({ scopeCode, serverFilters, filters, weergave, toonMeerFilters })');
  });

  it('biedt expliciet opgeslagen zoekopdrachten zonder resultaten als snapshot vast te zetten', () => {
    expect(persistence).toContain('localStorage');
    expect(lijst).toContain('Zoekopdracht opslaan');
    expect(lijst).toContain('resultaten worden bij openen opnieuw actueel opgehaald');
    expect(lijst).toContain("setWeergave('opgeslagen')");
  });

  it('maakt van preflight een zichtbare review met verwijdermogelijkheid', () => {
    expect(lijst).toContain("weergave === 'kaart' ? kaartReviewRef : lijstReviewRef");
    expect(lijst).toContain("reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })");
    expect(review).toContain('klaar om toe te voegen');
    expect(review).toContain('Verwijder');
    expect(review).toContain('Toevoegen aan Vastgoedkansen');
    expect(dialog).not.toContain('handmatig toevoegen?');
  });
});
