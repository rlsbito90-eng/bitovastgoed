import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const review = fs.readFileSync('src/components/bag/BagSelectieReview.tsx', 'utf8');
const persistence = fs.readFileSync('src/lib/bag/pandenverkennerPersistence.ts', 'utf8');
const repository = fs.readFileSync('src/lib/bag/zoekprofielenRepository.ts', 'utf8');
const migratie = fs.readFileSync('supabase/migrations/20260812191000_bag_saved_searches_v2.sql', 'utf8');
const dialog = fs.readFileSync('src/components/bag/BagHandmatigePromotieDialog.tsx', 'utf8');

describe('Pandenverkenner workflow & persistence', () => {
  it('herstelt filters en werkweergave binnen dezelfde browsersessie', () => {
    expect(persistence).toContain('sessionStorage');
    expect(lijst).toContain('leesWerkcontext(scopeCode)');
    expect(lijst).toContain('bewaarWerkcontext({ scopeCode, serverFilters, filters, weergave, toonMeerFilters })');
  });

  it('synchroniseert opgeslagen zoekopdrachten accountgebonden en bewaart geen resultaatsnapshot', () => {
    expect(repository).toContain("from('bag_zoekprofielen')");
    expect(repository).toContain('supabase.auth.getUser()');
    expect(lijst).toContain('gekoppeld aan je Bito-account');
    expect(lijst).toContain('resultaten worden steeds opnieuw actueel opgehaald');
    expect(lijst).toContain('Wijzigingen opslaan');
    expect(lijst).toContain('Opslaan als nieuw');
    expect(migratie).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migratie).toContain('auth.uid() = user_id');
    expect(persistence).toContain('éénmalig naar het account te migreren');
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
