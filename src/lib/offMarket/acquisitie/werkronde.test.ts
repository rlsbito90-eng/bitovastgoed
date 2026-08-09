import { describe, expect, it } from 'vitest';
import {
  WERKRONDE_KEY,
  eerstVolgendeId,
  hervatIndex,
  leesWerkronde,
  markeerBehandeld,
  markeerOvergeslagen,
  parseWerkronde,
  schrijfWerkronde,
  startWerkronde,
  verwijderUitWerkronde,
  voortgang,
  wisWerkronde,
  zetPositie,
  type StorageLike,
} from './werkronde';

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('werkronde', () => {
  it('start met een vaste scope en het eerste item als huidige positie', () => {
    const ronde = startWerkronde({
      bron: 'te_posten',
      naam: 'Te posten (3)',
      scopeIds: ['a', 'b', 'c'],
      nu: '2026-08-01T00:00:00.000Z',
    });

    expect(ronde.scopeIds).toEqual(['a', 'b', 'c']);
    expect(ronde.huidigeId).toBe('a');
    expect(ronde.behandeldeIds).toEqual([]);
    expect(ronde.overgeslagenIds).toEqual([]);
  });

  it('accepteert expliciete bronnen voor onderzoeken en opvolgen', () => {
    expect(startWerkronde({ bron: 'onderzoeken', naam: 'Onderzoeken', scopeIds: ['a'] }).bron)
      .toBe('onderzoeken');
    expect(startWerkronde({ bron: 'opvolgen', naam: 'Opvolgen', scopeIds: ['a'] }).bron)
      .toBe('opvolgen');
  });

  it('registreert behandelen en verwijdert dezelfde id uit overgeslagen', () => {
    const gestart = startWerkronde({
      bron: 'werkbak',
      naam: 'Actie',
      scopeIds: ['a', 'b'],
    });
    const overgeslagen = markeerOvergeslagen(gestart, 'a');
    const behandeld = markeerBehandeld(overgeslagen, 'a');

    expect(behandeld.behandeldeIds).toEqual(['a']);
    expect(behandeld.overgeslagenIds).toEqual([]);
  });

  it('telt behandeld, overgeslagen en resterend zonder dubbeltellingen', () => {
    let ronde = startWerkronde({
      bron: 'handmatig',
      naam: 'Selectie',
      scopeIds: ['a', 'b', 'c', 'd'],
    });
    ronde = markeerOvergeslagen(ronde, 'a');
    ronde = markeerBehandeld(ronde, 'b');
    ronde = markeerBehandeld(ronde, 'a');

    expect(voortgang(ronde)).toEqual({
      totaal: 4,
      behandeld: 2,
      overgeslagen: 0,
      resterend: 2,
    });
  });

  it('kiest eerst onbehandelde items en pas daarna overgeslagen items', () => {
    let ronde = startWerkronde({
      bron: 'werkbak',
      naam: 'Actie',
      scopeIds: ['a', 'b', 'c'],
    });
    ronde = markeerOvergeslagen(ronde, 'a');

    expect(eerstVolgendeId(ronde, ['a', 'b', 'c'])).toBe('b');

    ronde = markeerBehandeld(ronde, 'b');
    ronde = markeerBehandeld(ronde, 'c');

    expect(eerstVolgendeId(ronde, ['a', 'b', 'c'])).toBe('a');
    expect(hervatIndex(ronde, ['a', 'b', 'c'])).toBe(0);
  });

  it('bewaart en leest een geldige werkronde', () => {
    const storage = new MemoryStorage();
    const ronde = zetPositie(
      startWerkronde({
        bron: 'brief_voorbereiden',
        naam: 'Brief voorbereiden',
        scopeIds: ['a', 'b'],
      }),
      'b',
    );

    schrijfWerkronde(ronde, storage);
    expect(leesWerkronde(storage)).toEqual(ronde);

    wisWerkronde(storage);
    expect(storage.getItem(WERKRONDE_KEY)).toBeNull();
  });

  it('blijft bestaande versie-1 rondes met legacy bron werkbak parsen', () => {
    const legacy = JSON.stringify({
      versie: 1,
      bron: 'werkbak',
      naam: 'Actie',
      scopeIds: ['a', 'b'],
      behandeldeIds: [],
      overgeslagenIds: [],
      huidigeId: 'a',
      gestartOp: '2026-08-01T00:00:00.000Z',
      laatstBijgewerktOp: '2026-08-01T00:00:00.000Z',
    });

    expect(parseWerkronde(legacy)?.bron).toBe('werkbak');
  });

  it('weigert ongeldige of verouderde opslagdata defensief', () => {
    expect(parseWerkronde(null)).toBeNull();
    expect(parseWerkronde('{ongeldig')).toBeNull();
    expect(parseWerkronde(JSON.stringify({ versie: 2 }))).toBeNull();
    expect(parseWerkronde(JSON.stringify({
      versie: 1,
      bron: 'werkbak',
      naam: 'Leeg',
      scopeIds: [],
      behandeldeIds: [],
      overgeslagenIds: [],
      gestartOp: '2026-08-01T00:00:00.000Z',
    }))).toBeNull();
  });

  it('verwijdert alleen het bedoelde item uit de ronde en behoudt de rest', () => {
    let ronde = startWerkronde({
      bron: 'te_printen',
      naam: 'Te printen',
      scopeIds: ['a', 'b', 'c'],
    });
    ronde = markeerBehandeld(ronde, 'a');
    ronde = markeerOvergeslagen(ronde, 'b');
    ronde = zetPositie(ronde, 'b');

    const gewijzigd = verwijderUitWerkronde(ronde, 'b');

    expect(gewijzigd?.scopeIds).toEqual(['a', 'c']);
    expect(gewijzigd?.behandeldeIds).toEqual(['a']);
    expect(gewijzigd?.overgeslagenIds).toEqual([]);
    expect(gewijzigd?.huidigeId).toBeNull();
  });

  it('beëindigt de ronde wanneer het laatste scope-item wordt verwijderd', () => {
    const ronde = startWerkronde({
      bron: 'handmatig',
      naam: 'Eén item',
      scopeIds: ['a'],
    });

    expect(verwijderUitWerkronde(ronde, 'a')).toBeNull();
  });
});
