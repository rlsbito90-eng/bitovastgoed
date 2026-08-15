import { describe, expect, it } from 'vitest';
import { bepaalPrimaireWerkTab } from '@/lib/vastgoedkansWorkspace';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';

const kans = (extra: Partial<Vastgoedkans> = {}): Vastgoedkans => ({
  id: 'kans-1',
  status: 'te_beoordelen',
  bagPandId: 'pand-1',
  bagVerblijfsobjectId: null,
  kadasterStatus: 'niet_gestart',
  kadasterLaatstGecontroleerdOp: null,
  eigenaarStatus: 'niet_gestart',
  eigenaarLaatstGecontroleerdOp: null,
  briefStatus: 'niet_gestart',
  briefVerzondenOp: null,
  opvolgdatum: null,
  reactieStatus: 'geen_reactie',
  reactieOntvangenOp: null,
  volgendeActieDatum: null,
  volgendeActieOmschrijving: null,
  archivedAt: null,
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z',
  ...extra,
} as Vastgoedkans);

describe('BUILD 2.0C — direct doorgaan naar workflowactie', () => {
  it('opent een nieuwe vastgoedkans op Overzicht voor beoordeling', () => {
    expect(bepaalPrimaireWerkTab(kans())).toBe('overzicht');
  });

  it('opent eigenaar- en rechthebbendenwerk op Kadaster & eigenaar', () => {
    expect(bepaalPrimaireWerkTab(kans({
      kadasterStatus: 'gegevens_bekend',
      kadasterLaatstGecontroleerdOp: '2026-08-09',
      eigenaarStatus: 'niet_gestart',
    }))).toBe('kadaster');
  });

  it('opent Brief voorbereiden direct op Brieven & opvolging', () => {
    expect(bepaalPrimaireWerkTab(kans({
      kadasterStatus: 'gegevens_bekend',
      kadasterLaatstGecontroleerdOp: '2026-08-09',
      eigenaarStatus: 'bekend',
      eigenaarLaatstGecontroleerdOp: '2026-08-10',
    }))).toBe('brieven');
  });

  it('opent verzendopvolging en reacties op Brieven & opvolging', () => {
    expect(bepaalPrimaireWerkTab(kans({
      kadasterStatus: 'gegevens_bekend',
      kadasterLaatstGecontroleerdOp: '2026-08-09',
      eigenaarStatus: 'bekend',
      eigenaarLaatstGecontroleerdOp: '2026-08-10',
      briefStatus: 'verzonden',
      briefVerzondenOp: '2026-08-11',
      opvolgdatum: '2026-08-20',
    }))).toBe('brieven');
  });

  it('behoudt Onderzoek als veilige fallback als er geen BAG-object is', () => {
    expect(bepaalPrimaireWerkTab(kans({ bagPandId: null, bagVerblijfsobjectId: null }))).toBe('overzicht');
  });
});
