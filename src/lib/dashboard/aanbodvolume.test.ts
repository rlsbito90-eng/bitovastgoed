import { describe, expect, it } from 'vitest';
import { berekenAanbodvolume } from './aanbodvolume';

describe('berekenAanbodvolume', () => {
  it('telt bekende vraagprijzen op en telt objecten zonder vraagprijs apart', () => {
    expect(berekenAanbodvolume([
      { id: 'a', vraagprijs: 415000 },
      { id: 'b', vraagprijs: 900000 },
      { id: 'c', vraagprijs: null },
      { id: 'd', vraagprijs: 0 },
    ])).toEqual({ totaal: 1315000, zonderVraagprijs: 2 });
  });

  it('telt een portefeuille met vraagprijs één keer, ook als deelobjecten een prijs hebben', () => {
    expect(berekenAanbodvolume([
      { id: 'p', vraagprijs: 3695000 },
      { id: 'k1', vraagprijs: 1500000, parentObjectId: 'p' },
      { id: 'k2', vraagprijs: null, parentObjectId: 'p' },
    ])).toEqual({ totaal: 3695000, zonderVraagprijs: 0 });
  });

  it('gebruikt de deelobjecten als de portefeuille zelf geen vraagprijs heeft', () => {
    expect(berekenAanbodvolume([
      { id: 'p', vraagprijs: null },
      { id: 'k1', vraagprijs: 1000000, parentObjectId: 'p' },
      { id: 'k2', vraagprijs: 800000, parentObjectId: 'p' },
      { id: 'k3', vraagprijs: null, parentObjectId: 'p' },
    ])).toEqual({ totaal: 1800000, zonderVraagprijs: 1 });
  });

  it('telt een portefeuille zonder enige bekende prijs als één onbekende post', () => {
    expect(berekenAanbodvolume([
      { id: 'p', vraagprijs: null },
      { id: 'k1', vraagprijs: null, parentObjectId: 'p' },
      { id: 'k2', vraagprijs: null, parentObjectId: 'p' },
    ])).toEqual({ totaal: 0, zonderVraagprijs: 1 });
  });

  it('telt een deelobject als los object als de ouder niet actief is', () => {
    expect(berekenAanbodvolume([
      { id: 'k1', vraagprijs: 500000, parentObjectId: 'gearchiveerd' },
    ])).toEqual({ totaal: 500000, zonderVraagprijs: 0 });
  });
});
