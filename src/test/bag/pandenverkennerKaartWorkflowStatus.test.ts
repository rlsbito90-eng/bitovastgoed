import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bepaalBagKaartWorkflowStatus } from '@/lib/bag/pandenverkennerKaartStatus';

const kaart = readFileSync('src/components/bag/BagPandenKaart.tsx', 'utf8');

describe('Pandenverkenner visuele workflowstatus', () => {
  it('geeft CRM-lifecycle voorrang boven lokale selectie', () => {
    expect(bepaalBagKaartWorkflowStatus({ crmBron: 'vastgoedkans', vastgoedkansGearchiveerd: true, vastgoedkansInAcquisitie: true, lokaalGeselecteerd: true })).toBe('gearchiveerd');
    expect(bepaalBagKaartWorkflowStatus({ crmBron: 'vastgoedkans', vastgoedkansInAcquisitie: true, lokaalGeselecteerd: true })).toBe('acquisitie');
    expect(bepaalBagKaartWorkflowStatus({ crmBron: 'vastgoedkans', lokaalGeselecteerd: true })).toBe('vastgoedkans');
    expect(bepaalBagKaartWorkflowStatus({ crmBron: 'object', lokaalGeselecteerd: true })).toBe('crm_bekend');
  });

  it('onderscheidt nieuwe en lokaal geselecteerde BAG-panden', () => {
    expect(bepaalBagKaartWorkflowStatus({ crmBron: null })).toBe('nieuw');
    expect(bepaalBagKaartWorkflowStatus({ crmBron: null, lokaalGeselecteerd: true })).toBe('geselecteerd');
  });

  it('voegt status toe aan punten én contouren en toont een legenda', () => {
    expect(kaart).toContain("workflowStatus: feature.properties.itemType === 'pand'");
    expect(kaart).toContain('workflowStatus: workflowStatusPerPandId.get(feature.properties.id)');
    expect(kaart).toContain('Kaartlegenda workflowstatus');
    expect(kaart).toContain("'circle-color': WORKFLOW_KLEUR_EXPR");
    expect(kaart).toContain("'fill-color': WORKFLOW_KLEUR_EXPR");
    expect(kaart).toContain("'line-color': WORKFLOW_KLEUR_EXPR");
  });
});
