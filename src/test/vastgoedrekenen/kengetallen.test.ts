import { describe, expect, it } from 'vitest';
import {
  buildScenarioPatchForKengetal,
  buildSnapshotPayload,
  isKengetalExpired,
  isSnapshotOutdated,
  valueForBand,
  type VastgoedrekenenKengetal,
} from '@/lib/vastgoedrekenen/kengetallen';

const kengetal: VastgoedrekenenKengetal = {
  id: 'kengetal-1',
  code: 'doelwinst_gdv_transformatie_randstad',
  naam: 'Doelwinst op GDV — transformatie Randstad',
  categorie: 'rendement',
  eenheid: '%',
  minimum_waarde: 15,
  basis_waarde: 15,
  maximum_waarde: 20,
  scenario_veld: 'sale_target_margin_percentage',
  bron_type: 'interne_werkhypothese',
  bron_naam: 'Bito Vastgoed — Den Haag praktijkproef',
  bron_referentie: '15% basis; 20% voorzichtig',
  bron_peildatum: '2026-07-23',
  geldig_vanaf: '2026-07-23',
  vervaldatum: '2026-10-23',
  toepassingsgebied: ['transformatie'],
  regio: ['Den Haag', 'Randstad'],
  projectfase: ['haalbaarheid'],
  risicoklasse: ['basis', 'voorzichtig'],
  betrouwbaarheid: 'laag',
  toelichting: 'Interne werkhypothese',
  actief: true,
  versie: 2,
  created_by: null,
  created_at: '2026-07-23T20:00:00.000Z',
  updated_at: '2026-07-23T20:00:00.000Z',
};

describe('kengetallenregister en scenariosnapshots', () => {
  it('selecteert minimum, basis en maximum zonder interpretatie', () => {
    expect(valueForBand(kengetal, 'minimum')).toBe(15);
    expect(valueForBand(kengetal, 'basis')).toBe(15);
    expect(valueForBand(kengetal, 'maximum')).toBe(20);
  });

  it('bouwt een volledige onveranderlijke snapshot van de gekozen band', () => {
    const snapshot = buildSnapshotPayload({
      scenarioId: 'scenario-1',
      kengetal,
      band: 'maximum',
      userId: 'user-1',
      nowIso: '2026-07-23T21:00:00.000Z',
    });

    expect(snapshot.gekozen_waarde).toBe(20);
    expect(snapshot.register_versie).toBe(2);
    expect(snapshot.minimum_waarde).toBe(15);
    expect(snapshot.bron_naam).toContain('Den Haag');
    expect(snapshot.regio).toEqual(['Den Haag', 'Randstad']);
    expect(snapshot.snapshot_op).toBe('2026-07-23T21:00:00.000Z');
  });

  it('vereist een reden bij handmatige overschrijving', () => {
    expect(() => buildSnapshotPayload({
      scenarioId: 'scenario-1',
      kengetal,
      band: 'handmatig',
      manualValue: 17.5,
    })).toThrow('reden');

    const snapshot = buildSnapshotPayload({
      scenarioId: 'scenario-1',
      kengetal,
      band: 'handmatig',
      manualValue: 17.5,
      overrideReason: 'Projectspecifieke risico-opslag na bouwkundige opname.',
    });
    expect(snapshot.gekozen_waarde).toBe(17.5);
    expect(snapshot.overschreven).toBe(true);
    expect(snapshot.override_reden).toContain('risico-opslag');
  });

  it('maakt alleen voor expliciet gekoppelde velden een scenariopatch', () => {
    expect(buildScenarioPatchForKengetal('sale_target_margin_percentage', 20))
      .toEqual({ sale_target_margin_percentage: 20 });
    expect(buildScenarioPatchForKengetal(null, 20)).toEqual({});
  });

  it('signaleert verval en een nieuwere registerversie zonder snapshot te wijzigen', () => {
    expect(isKengetalExpired(kengetal, '2026-10-24')).toBe(true);
    expect(isKengetalExpired(kengetal, '2026-10-23')).toBe(false);
    expect(isSnapshotOutdated({ register_versie: 2 }, { versie: 3 })).toBe(true);
    expect(isSnapshotOutdated({ register_versie: 2 }, { versie: 2 })).toBe(false);
  });
});
