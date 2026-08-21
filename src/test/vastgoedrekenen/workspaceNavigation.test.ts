import { describe, expect, it } from 'vitest';
import {
  VR_WORKSPACE_DEFAULT_SECTION,
  VR_WORKSPACE_NAV_ITEMS,
  buildVrWorkspaceHref,
  resolveVrWorkspaceSection,
} from '@/lib/vastgoedrekenen/workspaceNavigation';

describe('Vastgoedrekenen workspace navigation', () => {
  it('valt veilig terug op de startpagina bij een ontbrekende of onbekende sectie', () => {
    expect(resolveVrWorkspaceSection('')).toBe(VR_WORKSPACE_DEFAULT_SECTION);
    expect(resolveVrWorkspaceSection('?sectie=onbekend')).toBe(VR_WORKSPACE_DEFAULT_SECTION);
  });

  it('herkent alle ondersteunde secties', () => {
    for (const item of VR_WORKSPACE_NAV_ITEMS) {
      const search = new URL(item.href, 'https://crm.test').search;
      expect(resolveVrWorkspaceSection(search)).toBe(item.section);
    }
  });

  it('houdt de bestaande basisroute geldig voor de startpagina', () => {
    expect(buildVrWorkspaceHref('start')).toBe('/vastgoedrekenen');
  });

  it('bouwt stabiele querylinks voor de overige werkgebieden', () => {
    expect(buildVrWorkspaceHref('projecten')).toBe('/vastgoedrekenen?sectie=projecten');
    expect(buildVrWorkspaceHref('bibliotheek')).toBe('/vastgoedrekenen?sectie=bibliotheek');
    expect(buildVrWorkspaceHref('bronbeheer')).toBe('/vastgoedrekenen?sectie=bronbeheer');
  });
});
