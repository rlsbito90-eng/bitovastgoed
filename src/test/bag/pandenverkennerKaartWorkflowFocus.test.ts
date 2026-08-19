import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const kaart = fs.readFileSync('src/components/bag/BagPandenKaartRuntime.tsx', 'utf8');
const review = fs.readFileSync('src/components/bag/BagSelectieReview.tsx', 'utf8');

describe('Pandenverkenner kaartworkflow en focus', () => {
  it('toont review en vervolgactie ook binnen de kaartweergave', () => {
    const kaartStart = lijst.indexOf("{weergave === 'kaart' && <>");
    const lijstStart = lijst.indexOf("<div className={weergave === 'zoeken' ? 'block' : 'hidden'}>");
    const kaartBlok = lijst.slice(kaartStart, lijstStart);
    expect(kaartBlok).toContain('Controleer selectie');
    expect(kaartBlok).toContain('BagSelectieReview');
    expect(kaartBlok).toContain('setPromotieOpen(true)');
    expect(review).toContain('Toevoegen aan Vastgoedkansen');
    expect(review).toContain('klaar om toe te voegen');
  });

  it('centreert een aangeklikt pand met popup-ruimte en laadt ontbrekende contourdata na focus', () => {
    expect(kaart).toMatch(/focusBewegingRef\.current\s*=\s*true/);
    expect(kaart).toMatch(/focusVerversNaMoveRef\.current\s*=\s*map\.getZoom\(\)\s*<\s*16\.5/);
    expect(kaart).toMatch(/zoom:\s*Math\.max\(map\.getZoom\(\),\s*16\.6\)/);
    expect(kaart).toMatch(/offset:\s*\[0,\s*110\]/);
    expect(kaart).toContain('anchor="bottom"');
    expect(kaart).toMatch(/if\s*\(focusVerversNaMoveRef\.current\)\s*\{\s*focusVerversNaMoveRef\.current\s*=\s*false;\s*void zoekInKaartgebied\(\);/);
    expect(kaart).toMatch(/if\s*\(clusterDrilldownRef\.current\)\s*\{\s*clusterDrilldownRef\.current\s*=\s*false;\s*void zoekInKaartgebied\(\);\s*return;/);
  });
});