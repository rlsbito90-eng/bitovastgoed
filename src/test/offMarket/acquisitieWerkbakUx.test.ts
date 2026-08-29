// Tests voor de nieuwe UX-modules van de Acquisitieselectie:
// print/post-filter, zichtbare sortering en de hervatbare werkronde.
import { describe, expect, it } from 'vitest';
import {
  bepaalPrintPostGroep, matchtPrintPostFilter, isPrintPostFilter,
} from '@/lib/offMarket/acquisitie/printPostFilter';
import {
  sorteerRijen, standaardSortering, type SorteerbareRij,
} from '@/lib/offMarket/acquisitie/sortering';
import {
  eerstVolgendeId, markeerBehandeld, markeerOvergeslagen, parseWerkronde,
  startWerkronde, verwijderUitWerkronde, voortgang,
} from '@/lib/offMarket/acquisitie/werkronde';
import type { WerkbakContext } from '@/lib/offMarket/acquisitie/werkbak';

function ctx(p: Partial<WerkbakContext> = {}): WerkbakContext {
  return {
    werkbak: 'actie',
    actieCategorie: 'gereed_voor_print',
    actieSubfilter: 'printen_posten',
    procesDatum: null,
    ...p,
  };
}

function rij(id: string, p: Partial<SorteerbareRij> = {}): SorteerbareRij {
  return {
    signaalId: id,
    toegevoegdOp: '2026-01-01T00:00:00.000Z',
    ctx: ctx(),
    procesDatumIsoWachten: null,
    prioriteit: null,
    aiScore: null,
    plaats: null,
    ...p,
  };
}

describe('printPostFilter', () => {
  it('splitst te printen en te posten', () => {
    expect(bepaalPrintPostGroep('gereed_voor_print')).toBe('te_printen');
    expect(bepaalPrintPostGroep('geprint_nog_posten')).toBe('te_posten');
    expect(bepaalPrintPostGroep('onderzoek')).toBeNull();
  });
  it('filtert correct', () => {
    expect(matchtPrintPostFilter('gereed_voor_print', 'te_printen')).toBe(true);
    expect(matchtPrintPostFilter('gereed_voor_print', 'te_posten')).toBe(false);
    expect(matchtPrintPostFilter('geprint_nog_posten', 'alles')).toBe(true);
    expect(matchtPrintPostFilter('onderzoek', 'alles')).toBe(false);
  });
  it('valideert waarden', () => {
    expect(isPrintPostFilter('te_posten')).toBe(true);
    expect(isPrintPostFilter('bogus')).toBe(false);
  });
});

describe('sortering', () => {
  it('kiest de contextuele standaardsortering per werkbak', () => {
    expect(standaardSortering('alles', 'alle', 'alles')).toBe('nieuwste_toegevoegd');
    expect(standaardSortering('actie', 'onderzoeken', 'alles')).toBe('nieuwste_toegevoegd');
    expect(standaardSortering('actie', 'opvolgen', 'alles')).toBe('opvolgdatum_oudste');
    expect(standaardSortering('actie', 'printen_posten', 'te_printen')).toBe('procesdatum');
  });

  it('sorteert nieuwste toegevoegd eerst', () => {
    const res = sorteerRijen('nieuwste_toegevoegd', 'alles', [
      rij('a', { toegevoegdOp: '2026-01-01T00:00:00.000Z' }),
      rij('b', { toegevoegdOp: '2026-03-01T00:00:00.000Z' }),
    ]);
    expect(res.map(r => r.signaalId)).toEqual(['b', 'a']);
  });

  it('sorteert op prioriteit en daarna op nieuwste', () => {
    const res = sorteerRijen('hoogste_prioriteit', 'alles', [
      rij('a', { prioriteit: 'laag' }),
      rij('b', { prioriteit: 'urgent' }),
      rij('c', { prioriteit: null }),
    ]);
    expect(res.map(r => r.signaalId)).toEqual(['b', 'a', 'c']);
  });

  it('sorteert op AI-score aflopend en plaats alfabetisch', () => {
    expect(sorteerRijen('hoogste_ai_score', 'alles', [
      rij('a', { aiScore: 40 }), rij('b', { aiScore: 90 }), rij('c'),
    ]).map(r => r.signaalId)).toEqual(['b', 'a', 'c']);
    expect(sorteerRijen('plaats_az', 'alles', [
      rij('a', { plaats: 'Utrecht' }), rij('b', { plaats: 'Amsterdam' }), rij('c'),
    ]).map(r => r.signaalId)).toEqual(['b', 'a', 'c']);
  });
});

describe('werkronde', () => {
  it('start met een vaste scope en telt voortgang', () => {
    const w = startWerkronde({ bron: 'te_printen', naam: 'Te printen (3)', scopeIds: ['a', 'b', 'c'] });
    expect(voortgang(w)).toEqual({ totaal: 3, behandeld: 0, overgeslagen: 0, resterend: 3 });
    const w2 = markeerOvergeslagen(markeerBehandeld(w, 'a'), 'b');
    expect(voortgang(w2)).toEqual({ totaal: 3, behandeld: 1, overgeslagen: 1, resterend: 1 });
  });

  it('behandeld wint van overgeslagen', () => {
    const w = startWerkronde({ bron: 'werkbak', naam: 'Actie', scopeIds: ['a'] });
    const w2 = markeerBehandeld(markeerOvergeslagen(w, 'a'), 'a');
    expect(voortgang(w2).behandeld).toBe(1);
    expect(voortgang(w2).overgeslagen).toBe(0);
  });

  it('hervat bij het eerste onbehandelde item, overgeslagen als laatste', () => {
    const w = startWerkronde({ bron: 'werkbak', naam: 'Actie', scopeIds: ['a', 'b', 'c'] });
    const w2 = markeerBehandeld(markeerOvergeslagen(w, 'a'), 'b');
    expect(eerstVolgendeId(w2, ['a', 'b', 'c'])).toBe('c');
    const w3 = markeerBehandeld(w2, 'c');
    expect(eerstVolgendeId(w3, ['a', 'b', 'c'])).toBe('a');
  });

  it('verwijdert een signaal uit de scope en eindigt bij lege scope', () => {
    const w = startWerkronde({ bron: 'werkbak', naam: 'Actie', scopeIds: ['a', 'b'] });
    const w2 = verwijderUitWerkronde(w, 'a');
    expect(w2?.scopeIds).toEqual(['b']);
    expect(verwijderUitWerkronde(w2!, 'b')).toBeNull();
  });

  it('parseWerkronde weigert ongeldige of lege payloads', () => {
    expect(parseWerkronde(null)).toBeNull();
    expect(parseWerkronde('{')).toBeNull();
    expect(parseWerkronde(JSON.stringify({ versie: 2 }))).toBeNull();
    const w = startWerkronde({ bron: 'te_posten', naam: 'Te posten', scopeIds: ['a'] });
    expect(parseWerkronde(JSON.stringify(w))?.scopeIds).toEqual(['a']);
  });
});
