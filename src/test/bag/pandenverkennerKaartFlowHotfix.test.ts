import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const kaart = fs.readFileSync('src/components/bag/BagPandenKaart.tsx', 'utf8');

describe('Pandenverkenner kaartflow hotfix', () => {
  it('blijft in kaartweergave na Controleer selectie en gebruikt de gedeelde review', () => {
    expect(lijst).toContain('onClick={controleerSelectie}');
    expect(lijst).toContain('<BagSelectieReview');
    expect(lijst).not.toContain("setWeergave('zoeken')");
  });

  it('gebruikt de expliciete gebiedszoekactie', () => {
    expect(kaart).toContain('Zoek in dit gebied');
    expect(kaart).not.toContain('Zoek in dit kaartgebied');
  });
});
