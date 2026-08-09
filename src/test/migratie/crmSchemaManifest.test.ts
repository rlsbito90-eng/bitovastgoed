import { describe, expect, it } from 'vitest';
import {
  BESCHERMDE_PROJECTEN,
  CRM_DOELPROJECT,
  CRM_SCHEMA_BUNDELS,
  UITGESLOTEN_VAN_EERSTE_CRM_SCHEMAOPBOUW,
} from '@/lib/migratie/crmSchemaManifest';

describe('CRM-MIG-2B schema-manifest', () => {
  it('houdt exact het zelfstandige CRM-doel aan', () => {
    expect(CRM_DOELPROJECT).toBe('vyjocdlwfxrblusfngfq');
    expect(BESCHERMDE_PROJECTEN).toEqual(expect.arrayContaining([
      'ljudxyrqoifhfikueric',
      'wzkhmjuasyuvzhhycnym',
      'xfygspvpeugxowxbcvnm',
    ]));
  });

  it('is uitsluitend voorbereidend en bevat geen uitvoerbare databasewrite', () => {
    expect(CRM_SCHEMA_BUNDELS.length).toBeGreaterThan(0);
    for (const bundel of CRM_SCHEMA_BUNDELS) {
      expect(bundel.schrijftDatabase).toBe(false);
      expect(bundel.tabellen.length).toBeGreaterThan(0);
    }
  });

  it('houdt BAG en latere kosten/objectidentiteit buiten de eerste CRM-schemaopbouw', () => {
    const geplandeTabellen = new Set(CRM_SCHEMA_BUNDELS.flatMap((bundel) => [...bundel.tabellen]));
    for (const uitgesloten of UITGESLOTEN_VAN_EERSTE_CRM_SCHEMAOPBOUW) {
      expect(geplandeTabellen.has(uitgesloten)).toBe(false);
    }
  });

  it('plaatst Off-Market na de CRM-basis en Vastgoedkansen na Off-Market', () => {
    const offMarket = CRM_SCHEMA_BUNDELS.find((bundel) => bundel.id === '2B-6');
    const vastgoedkansen = CRM_SCHEMA_BUNDELS.find((bundel) => bundel.id === '2B-7');
    expect(offMarket?.afhankelijkVan).toContain('2B-3');
    expect(vastgoedkansen?.afhankelijkVan).toContain('2B-6');
  });
});
