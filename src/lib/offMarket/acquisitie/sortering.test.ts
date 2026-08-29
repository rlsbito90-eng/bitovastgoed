import { describe, expect, it } from 'vitest';
import {
  isSorteerOptie,
  sorteerRijen,
  standaardSortering,
  type SorteerbareRij,
} from './sortering';

function rij(overrides: Partial<SorteerbareRij> & Pick<SorteerbareRij, 'signaalId'>): SorteerbareRij {
  return {
    signaalId: overrides.signaalId,
    toegevoegdOp: overrides.toegevoegdOp ?? null,
    procesDatumIsoWachten: overrides.procesDatumIsoWachten ?? null,
    prioriteit: overrides.prioriteit ?? null,
    aiScore: overrides.aiScore ?? null,
    plaats: overrides.plaats ?? null,
    ctx: overrides.ctx ?? {
      werkbak: 'actie',
      actieCategorie: 'onderzoek',
      actieSubfilter: 'onderzoeken',
      procesDatum: null,
    },
  };
}

describe('standaardSortering', () => {
  it('zet nieuwe en onderzoeksselecties standaard nieuwste eerst', () => {
    expect(standaardSortering('alles', 'alle', 'alles')).toBe('nieuwste_toegevoegd');
    expect(standaardSortering('actie', 'onderzoeken', 'alles')).toBe('nieuwste_toegevoegd');
    expect(standaardSortering('actie', 'brief_voorbereiden', 'alles')).toBe('nieuwste_toegevoegd');
  });

  it('zet opvolging oudste eerst en behoudt aanbevolen voor wachten en afgehandeld', () => {
    expect(standaardSortering('actie', 'opvolgen', 'alles')).toBe('opvolgdatum_oudste');
    expect(standaardSortering('wachten', 'alle', 'alles')).toBe('aanbevolen');
    expect(standaardSortering('afgehandeld', 'alle', 'alles')).toBe('aanbevolen');
  });

  it('gebruikt procesdatum voor een specifieke print/postgroep', () => {
    expect(standaardSortering('actie', 'printen_posten', 'te_printen')).toBe('procesdatum');
    expect(standaardSortering('actie', 'printen_posten', 'te_posten')).toBe('procesdatum');
    expect(standaardSortering('actie', 'printen_posten', 'alles')).toBe('aanbevolen');
  });
});

describe('sorteerRijen', () => {
  const basis = [
    rij({ signaalId: 'a', toegevoegdOp: '2026-07-01T10:00:00Z', prioriteit: 'laag', aiScore: 50, plaats: 'Tilburg' }),
    rij({ signaalId: 'b', toegevoegdOp: '2026-07-03T10:00:00Z', prioriteit: 'urgent', aiScore: 90, plaats: 'Breda' }),
    rij({ signaalId: 'c', toegevoegdOp: '2026-07-02T10:00:00Z', prioriteit: 'hoog', aiScore: null, plaats: null }),
  ];

  it('sorteert nieuwste en oudste toegevoegd deterministisch', () => {
    expect(sorteerRijen('nieuwste_toegevoegd', 'alles', basis).map(x => x.signaalId)).toEqual(['b', 'c', 'a']);
    expect(sorteerRijen('oudste_toegevoegd', 'alles', basis).map(x => x.signaalId)).toEqual(['a', 'c', 'b']);
  });

  it('sorteert prioriteit volgens urgent, hoog, midden, laag', () => {
    expect(sorteerRijen('hoogste_prioriteit', 'alles', basis).map(x => x.signaalId)).toEqual(['b', 'c', 'a']);
  });

  it('zet hoogste AI-score eerst en ontbrekende scores onderaan', () => {
    expect(sorteerRijen('hoogste_ai_score', 'alles', basis).map(x => x.signaalId)).toEqual(['b', 'a', 'c']);
  });

  it('sorteert plaats alfabetisch en ontbrekende plaatsen onderaan', () => {
    expect(sorteerRijen('plaats_az', 'alles', basis).map(x => x.signaalId)).toEqual(['b', 'a', 'c']);
  });

  it('sorteert relevante procesdatum nieuwste eerst en ontbrekende datum onderaan', () => {
    const rijen = [
      rij({ signaalId: 'a', ctx: { werkbak: 'actie', actieCategorie: 'gereed_voor_print', actieSubfilter: 'printen_posten', procesDatum: { iso: '2026-07-01', label: 'A', a11yLabel: 'A' } } }),
      rij({ signaalId: 'b', ctx: { werkbak: 'actie', actieCategorie: 'gereed_voor_print', actieSubfilter: 'printen_posten', procesDatum: { iso: '2026-07-03', label: 'B', a11yLabel: 'B' } } }),
      rij({ signaalId: 'c' }),
    ];
    expect(sorteerRijen('procesdatum', 'actie', rijen).map(x => x.signaalId)).toEqual(['b', 'a', 'c']);
  });

  it('sorteert opvolgdatum zowel oudste als nieuwste eerst', () => {
    const rijen = [
      rij({ signaalId: 'a', ctx: { werkbak: 'actie', actieCategorie: 'opvolging_verlopen', actieSubfilter: 'opvolgen', procesDatum: { iso: '2026-07-01', label: 'A', a11yLabel: 'A' } } }),
      rij({ signaalId: 'b', ctx: { werkbak: 'actie', actieCategorie: 'opvolging_verlopen', actieSubfilter: 'opvolgen', procesDatum: { iso: '2026-07-03', label: 'B', a11yLabel: 'B' } } }),
      rij({ signaalId: 'c' }),
    ];
    expect(sorteerRijen('opvolgdatum_oudste', 'actie', rijen).map(x => x.signaalId)).toEqual(['a', 'b', 'c']);
    expect(sorteerRijen('opvolgdatum_nieuwste', 'actie', rijen).map(x => x.signaalId)).toEqual(['b', 'a', 'c']);
  });
});

describe('isSorteerOptie', () => {
  it('accepteert alleen gepubliceerde sorteeropties', () => {
    expect(isSorteerOptie('aanbevolen')).toBe(true);
    expect(isSorteerOptie('procesdatum')).toBe(true);
    expect(isSorteerOptie('opvolgdatum_oudste')).toBe(true);
    expect(isSorteerOptie('opvolgdatum_nieuwste')).toBe(true);
    expect(isSorteerOptie('willekeurig')).toBe(false);
  });
});
