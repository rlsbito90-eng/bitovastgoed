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

  it('centreert een aangeklikt pand met ruimte voor de popup zonder kaartdata stale te markeren', () => {
    expect(kaart).toContain('focusBewegingRef.current=true');
    expect(kaart).toContain('zoom:Math.max(map.getZoom(),17)');
    expect(kaart).toContain('offset:[0,110]');
    expect(kaart).toContain('anchor="bottom"');
    expect(kaart).toContain('if(focusBewegingRef.current){focusBewegingRef.current=false;return;}');
  });
});
