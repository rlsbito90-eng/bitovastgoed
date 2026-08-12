import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const kaart = fs.readFileSync('src/components/bag/BagPandenKaart.tsx', 'utf8');

describe('Pandenverkenner kaartflow hotfix', () => {
  it('blijft in kaartweergave na Controleer selectie', () => {
    expect(lijst).toContain('onClick={() => setPreflight(beoordeelBagSelectie(selectiePanden, geselecteerd, context))}');
    expect(lijst).not.toContain("setPreflight(beoordeelBagSelectie(selectiePanden, geselecteerd, context)); setWeergave('zoeken')");
  });

  it('gebruikt de actiegerichte kaartlabeltekst', () => {
    expect(kaart).toContain('Toon panden in beeld');
    expect(kaart).not.toContain('Zoek in dit kaartgebied');
  });
});
