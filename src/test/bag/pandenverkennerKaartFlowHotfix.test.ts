import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const kaart = fs.readFileSync('src/components/bag/BagPandenKaart.tsx', 'utf8');

describe('Pandenverkenner kaartflow hotfix', () => {
  it('blijft in kaartweergave na Controleer selectie en gebruikt de gedeelde review', () => {
    const start = lijst.indexOf('const controleerSelectie = () => {');
    const einde = lijst.indexOf('const verwijderUitReview', start);
    const controleerSelectieBlok = lijst.slice(start, einde);
    expect(start).toBeGreaterThan(-1);
    expect(controleerSelectieBlok).toContain('setPreflight(beoordeling)');
    expect(controleerSelectieBlok).toContain("weergave === 'kaart' ? kaartReviewRef : lijstReviewRef");
    expect(controleerSelectieBlok).toContain("reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })");
    expect(controleerSelectieBlok).not.toContain('setWeergave');
    expect(lijst).toContain('<BagSelectieReview');
  });

  it('gebruikt de expliciete gebiedszoekactie', () => {
    expect(kaart).toContain('Ververs kaart');
    expect(kaart).not.toContain('Zoek in dit kaartgebied');
  });
});
