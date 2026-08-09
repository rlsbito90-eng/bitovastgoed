import { describe, expect, it } from 'vitest';
import type { WerkbakContext } from './werkbak';
import {
  focusTabVoorWerkbakContext,
  hoortWerkbakContextBijBron,
  werkrondeBronVoorView,
} from './werkrondeContext';

function ctx(overrides: Partial<WerkbakContext>): WerkbakContext {
  return {
    werkbak: 'actie',
    actieSubfilter: 'onderzoeken',
    actieCategorie: 'onderzoek',
    procesDatum: null,
    ...overrides,
  } as WerkbakContext;
}

describe('werkrondeContext', () => {
  it('maakt van Onderzoeken en Opvolgen expliciete werkrondebronnen', () => {
    expect(werkrondeBronVoorView({
      heeftHandmatigeSelectie: false, werkbak: 'actie', subfilter: 'onderzoeken', printPost: 'te_printen',
    })).toBe('onderzoeken');
    expect(werkrondeBronVoorView({
      heeftHandmatigeSelectie: false, werkbak: 'actie', subfilter: 'opvolgen', printPost: 'te_printen',
    })).toBe('opvolgen');
  });

  it('behoudt bestaande brief- en print/postbronnen', () => {
    expect(werkrondeBronVoorView({
      heeftHandmatigeSelectie: false, werkbak: 'actie', subfilter: 'brief_voorbereiden', printPost: 'te_printen',
    })).toBe('brief_voorbereiden');
    expect(werkrondeBronVoorView({
      heeftHandmatigeSelectie: false, werkbak: 'actie', subfilter: 'printen_posten', printPost: 'te_printen',
    })).toBe('te_printen');
    expect(werkrondeBronVoorView({
      heeftHandmatigeSelectie: false, werkbak: 'actie', subfilter: 'printen_posten', printPost: 'te_posten',
    })).toBe('te_posten');
  });

  it('controleert of een dossier nog bij Onderzoeken of Opvolgen hoort', () => {
    expect(hoortWerkbakContextBijBron('onderzoeken', ctx({ actieSubfilter: 'onderzoeken' }))).toBe(true);
    expect(hoortWerkbakContextBijBron('onderzoeken', ctx({ actieSubfilter: 'brief_voorbereiden' }))).toBe(false);
    expect(hoortWerkbakContextBijBron('opvolgen', ctx({ actieSubfilter: 'opvolgen' }))).toBe(true);
    expect(hoortWerkbakContextBijBron('opvolgen', ctx({ actieSubfilter: 'onderzoeken' }))).toBe(false);
  });

  it('routeert alleen Onderzoeken naar Kadaster, overige acquisitiecontext naar Brieven', () => {
    expect(focusTabVoorWerkbakContext(ctx({ actieSubfilter: 'onderzoeken' }))).toBe('kadaster');
    expect(focusTabVoorWerkbakContext(ctx({ actieSubfilter: 'brief_voorbereiden' }))).toBe('brieven');
    expect(focusTabVoorWerkbakContext(ctx({ actieSubfilter: 'printen_posten' }))).toBe('brieven');
    expect(focusTabVoorWerkbakContext(ctx({ actieSubfilter: 'opvolgen' }))).toBe('brieven');
    expect(focusTabVoorWerkbakContext(ctx({ werkbak: 'wachten', actieSubfilter: null }))).toBe('brieven');
  });
});
