import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const lijst = fs.readFileSync('src/components/bag/BagServicePandenlijst.tsx', 'utf8');
const kaart = fs.readFileSync('src/components/bag/BagPandenKaart.tsx', 'utf8');
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
    expect(kaart).toContain('focusBewegingRef.current=true');
    expect(kaart).toContain('focusVerversNaMoveRef.current=map.getZoom()<16.5');
    expect(kaart).toContain('zoom:Math.max(map.getZoom(),16.6)');
    expect(kaart).toContain('offset:[0,110]');
    expect(kaart).toContain('anchor="bottom"');
    expect(kaart).toContain('if(focusVerversNaMoveRef.current){focusVerversNaMoveRef.current=false;void zoekInKaartgebied();}');
    expect(kaart).toContain('if(clusterDrilldownRef.current){clusterDrilldownRef.current=false;void zoekInKaartgebied();return;}');
  });
});
