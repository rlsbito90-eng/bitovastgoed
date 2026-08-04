import { describe, expect, it } from 'vitest';
import {
  ASSEN_CAPACITEITSBASELINE,
  BAG_TRANCHE_GRENS_RIJEN,
  beoordeelBagImportGoNoGo,
  raamBagScopeCapaciteit,
} from './capacityPlanning';

describe('BAG capaciteitsplanning', () => {
  it('reproduceert de gemeten Assen-baseline', () => {
    const raming = raamBagScopeCapaciteit('0106', ASSEN_CAPACITEITSBASELINE.objecten);
    expect(raming.objecten).toBe(128_745);
    expect(raming.voorkomens).toBe(168_047);
    expect(raming.relaties).toBe(160_351);
    expect(raming.geometrieen).toBe(122_375);
    expect(raming.opslagBytes).toBe(253_902_848);
    expect(raming.aanbevolenVrijeRuimteBytes).toBe(507_805_696);
  });

  it('schaalt alle rijsoorten en opslag proportioneel', () => {
    const raming = raamBagScopeCapaciteit('0363', ASSEN_CAPACITEITSBASELINE.objecten * 2);
    expect(raming.schaalfactor).toBe(2);
    expect(raming.totaalRijen).toBe(1_159_036);
    expect(raming.opslagBytes).toBe(507_805_696);
  });

  it('markeert een grote raming voor tranchegewijze import', () => {
    const raming = raamBagScopeCapaciteit('0363', ASSEN_CAPACITEITSBASELINE.objecten * 4);
    expect(raming.totaalRijen).toBeGreaterThan(BAG_TRANCHE_GRENS_RIJEN);
    expect(raming.trancheNodig).toBe(true);
  });

  it('blokkeert import bij ontbrekende bronvalidatie, ruimte of rollback', () => {
    const raming = raamBagScopeCapaciteit('0363', 200_000);
    const beoordeling = beoordeelBagImportGoNoGo({
      bronGevalideerd: false,
      vrijeRuimteBytes: 0,
      raming,
      rollbackGetest: false,
      clientScopeToegestaan: false,
      serverScopeToegestaan: false,
    });
    expect(beoordeling.toegestaan).toBe(false);
    expect(beoordeling.blokkades).toHaveLength(3);
  });

  it('vereist dat Amsterdam tijdens de import nog niet querybaar is', () => {
    const raming = raamBagScopeCapaciteit('0363', 200_000);
    const beoordeling = beoordeelBagImportGoNoGo({
      bronGevalideerd: true,
      vrijeRuimteBytes: raming.aanbevolenVrijeRuimteBytes,
      raming,
      rollbackGetest: true,
      clientScopeToegestaan: true,
      serverScopeToegestaan: false,
    });
    expect(beoordeling.toegestaan).toBe(false);
    expect(beoordeling.blokkades).toContain('De nieuwe scope mag voor de import nog niet querybaar zijn.');
  });
});
