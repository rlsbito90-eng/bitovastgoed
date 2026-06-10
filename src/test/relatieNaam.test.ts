import { describe, it, expect } from 'vitest';
import {
  getRelationDisplayName,
  getRelatieNamen,
  getRelatieDropdownLabel,
} from '@/lib/relatieNaam';
import type { Relatie, RelatieContactpersoon } from '@/data/mock-data';

const baseRel = (over: Partial<Relatie> = {}): Relatie =>
  ({
    id: 'r1',
    bedrijfsnaam: '',
    contactpersoon: '',
    type: 'belegger',
    telefoon: '',
    email: '',
    leadStatus: 'lauw',
    ndaGetekend: false,
    laatsteContact: '',
    ...over,
  }) as Relatie;

describe('getRelationDisplayName', () => {
  it('prioriteert primaire contactpersoon boven bedrijfsnaam', () => {
    const rel = baseRel({ id: 'r1', bedrijfsnaam: 'J&CB Invest' });
    const cps: RelatieContactpersoon[] = [
      { id: 'c1', relatieId: 'r1', naam: 'Alexander', isPrimair: true, decisionMaker: false, voorkeurTaal: 'nl' } as any,
    ];
    expect(getRelationDisplayName(rel, cps)).toBe('Alexander');
    expect(getRelatieNamen(rel, cps).secundair).toBe('J&CB Invest');
  });

  it('valt terug op bedrijfsnaam als naam ontbreekt', () => {
    const rel = baseRel({ bedrijfsnaam: 'J&CB Invest' });
    expect(getRelationDisplayName(rel)).toBe('J&CB Invest');
  });

  it('toont nooit email als naam en bedrijf ontbreken (privacy-regel)', () => {
    const rel = baseRel({ email: 'foo@bar.nl', type: 'belegger' });
    expect(getRelationDisplayName(rel)).toBe('Belegger zonder naam');
  });

  it('geeft "Relatie zonder naam" zonder bruikbare data', () => {
    const rel = baseRel({ type: 'overig' });
    expect(getRelationDisplayName(rel)).toBe('Relatie zonder naam');
  });

  it('behandelt placeholder "Onbekend" als leeg', () => {
    const rel = baseRel({ bedrijfsnaam: 'Onbekend', email: 'a@b.nl' });
    expect(getRelationDisplayName(rel)).toBe('a@b.nl');
  });

  it('toont nooit "Onbekend" als fallback', () => {
    const rel = baseRel({ bedrijfsnaam: 'Onbekend' });
    const out = getRelationDisplayName(rel);
    expect(out.toLowerCase()).not.toContain('onbekend');
  });

  it('dropdown-label combineert naam en bedrijf', () => {
    const rel = baseRel({ id: 'r1', bedrijfsnaam: 'J&CB Invest' });
    const cps: RelatieContactpersoon[] = [
      { id: 'c1', relatieId: 'r1', naam: 'Alexander', isPrimair: true, decisionMaker: false, voorkeurTaal: 'nl' } as any,
    ];
    expect(getRelatieDropdownLabel(rel, cps)).toBe('Alexander · J&CB Invest');
  });
});
