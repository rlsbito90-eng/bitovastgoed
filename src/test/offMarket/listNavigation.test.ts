import { describe, it, expect, beforeEach } from 'vitest';
import {
  findVisibleListRow,
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

describe('findVisibleListRow — desktop restore kiest zichtbare duplicate row', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('negeert de verborgen mobiele rij met hetzelfde data-row-id', () => {
    const mobiel = document.createElement('div');
    mobiel.dataset.rowId = 'A';
    mobiel.style.display = 'none';
    mobiel.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0, x: 0, y: 0, toJSON: () => ({}) });

    const desktop = document.createElement('tr');
    desktop.dataset.rowId = 'A';
    desktop.getBoundingClientRect = () => ({ width: 1200, height: 64, top: 500, bottom: 564, left: 0, right: 1200, x: 0, y: 500, toJSON: () => ({}) });

    document.body.append(mobiel, desktop);

    expect(findVisibleListRow('A')).toBe(desktop);
  });
});
