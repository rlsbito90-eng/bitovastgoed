import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Pandenverkenner UX 1E.3 contract', () => {
  const kaart = fs.readFileSync('src/components/bag/BagPandenKaartRuntime.tsx', 'utf8');
  const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
  const promotie = fs.readFileSync('src/lib/bag/handmatigePromotie.ts', 'utf8');

  it('maakt kaartpopup actiegericht zonder directe CRM-write', () => {
    expect(kaart).toContain('Selecteer kandidaat');
    expect(kaart).toContain('Google Maps');
    expect(kaart).toContain('BAG-ID');
    expect(kaart).not.toContain('Toevoegen aan CRM');
  });

  it('gebruikt dezelfde selectie en preflight voor kaartkandidaten', () => {
    expect(lijst).toContain('kaartKandidaten');
    expect(lijst).toContain('beoordeelBagSelectie(selectiePanden, geselecteerd, context)');
    expect(lijst).toContain('onKandidaatToggle={toggleKaartKandidaat}');
  });

  it('legt kaartprovenance expliciet vast', () => {
    expect(promotie).toContain('geselecteerd via kaart');
  });
});