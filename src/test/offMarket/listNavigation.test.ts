import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveListLastViewed,
  loadListLastViewed,
  updateListLastViewedId,
} from '@/lib/listNavigation';

describe('updateListLastViewedId — Vorige/Volgende synchroniseert lastViewedId', () => {
  beforeEach(() => sessionStorage.clear());

  it('werkt het id bij en behoudt eerder opgeslagen scrollY', () => {
    saveListLastViewed('off-market-signalen', { id: 'A', scrollY: 420, ts: 1 });
    updateListLastViewedId('off-market-signalen', 'B');
    const lv = loadListLastViewed('off-market-signalen');
    expect(lv?.id).toBe('B');
    expect(lv?.scrollY).toBe(420);
  });

  it('initialiseert zonder voorgaande state met scrollY 0', () => {
    updateListLastViewedId('off-market-signalen', 'X');
    const lv = loadListLastViewed('off-market-signalen');
    expect(lv).toMatchObject({ id: 'X', scrollY: 0 });
  });

  it('volgende-klik daarna terug-klik wijst naar laatst actieve signaal', () => {
    // simuleer openen vanaf lijst
    saveListLastViewed('off-market-signalen', { id: 'A', scrollY: 300, ts: 1 });
    // Volgende
    updateListLastViewedId('off-market-signalen', 'B');
    // Volgende
    updateListLastViewedId('off-market-signalen', 'C');
    // Terug → lijst leest lastViewed
    const lv = loadListLastViewed('off-market-signalen');
    expect(lv?.id).toBe('C');
  });
});
