import { describe, expect, it } from 'vitest';
import { isRijselectieToets, magRijselectieWisselen } from './selecteerbareRij';

describe('selecteerbare acquisitierij', () => {
  it('laat klikken op vrije rijruimte de selectie wisselen', () => {
    const target = document.createElement('div');
    expect(magRijselectieWisselen({ target })).toBe(true);
  });

  it('beschermt knoppen, links, invoervelden en expliciet uitgesloten bediening', () => {
    const rij = document.createElement('div');
    const knop = document.createElement('button');
    const link = document.createElement('a');
    const invoer = document.createElement('input');
    const uitgesloten = document.createElement('span');
    uitgesloten.dataset.noRowSelect = 'true';
    rij.append(knop, link, invoer, uitgesloten);

    expect(magRijselectieWisselen({ target: knop })).toBe(false);
    expect(magRijselectieWisselen({ target: link })).toBe(false);
    expect(magRijselectieWisselen({ target: invoer })).toBe(false);
    expect(magRijselectieWisselen({ target: uitgesloten })).toBe(false);
  });

  it('wisselt niet wanneer de gebruiker tekst selecteert', () => {
    const target = document.createElement('div');
    expect(magRijselectieWisselen({ target, huidigeTekstselectie: 'Prinsengracht 687A' })).toBe(false);
  });

  it('ondersteunt spatie en Enter voor toetsenbordbediening', () => {
    expect(isRijselectieToets(' ')).toBe(true);
    expect(isRijselectieToets('Enter')).toBe(true);
    expect(isRijselectieToets('Escape')).toBe(false);
  });
});
