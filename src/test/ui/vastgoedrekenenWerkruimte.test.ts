import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  VR_WORKSPACE_NAV_ITEMS,
  buildVrWorkspaceHref,
  resolveVrWorkspaceSection,
} from '@/lib/vastgoedrekenen/workspaceNavigation';
import {
  VR_DEFAULT_LAYOUT,
  VR_LAYOUT_STORAGE_KEY,
  loadLayoutPrefs,
  moveWidget,
  normalizeLayoutPrefs,
  resetLayoutPrefs,
  saveLayoutPrefs,
  toggleWidget,
  visibleWidgets,
} from '@/lib/vastgoedrekenen/workspaceLayoutPrefs';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Vastgoedrekenen werkruimte — sectienavigatie', () => {
  it('resolveert bekende secties en valt veilig terug', () => {
    expect(resolveVrWorkspaceSection('?sectie=projecten')).toBe('projecten');
    expect(resolveVrWorkspaceSection('?sectie=bronbeheer')).toBe('bronbeheer');
    expect(resolveVrWorkspaceSection('?sectie=onzin')).toBe('start');
    expect(resolveVrWorkspaceSection('')).toBe('start');
  });

  it('bouwt links met behoud van de bestaande route', () => {
    expect(buildVrWorkspaceHref('start')).toBe('/vastgoedrekenen');
    expect(buildVrWorkspaceHref('quickscans')).toBe('/vastgoedrekenen?sectie=quickscans');
    expect(VR_WORKSPACE_NAV_ITEMS).toHaveLength(7);
    for (const item of VR_WORKSPACE_NAV_ITEMS) {
      expect(item.href.startsWith('/vastgoedrekenen')).toBe(true);
      expect(resolveVrWorkspaceSection(item.href.split('?')[1] ?? '')).toBe(item.section);
    }
  });

  it('toont het submenu in de zijbalk binnen /vastgoedrekenen', () => {
    const layout = source('src/components/AppLayout.tsx');
    expect(layout).toContain('VastgoedrekenenSubmenu');
    expect(layout).toContain('pathname.startsWith("/vastgoedrekenen")');
    expect(layout).toContain('!desktopCollapsed && (');
    expect(layout).toContain('onNavigate={() => setMobileOpen(false)}');
  });
});

describe('Vastgoedrekenen werkruimte — pagina-opbouw', () => {
  const page = source('src/pages/VastgoedrekenenPage.tsx');

  it('rendert één werkgebied per sectie in plaats van één lange stapeling', () => {
    expect(page).toContain("sectie === 'bibliotheek'");
    expect(page).toContain("sectie === 'bronbeheer'");
    expect(page).toContain('KengetallenRegisterPanel');
    expect(page).toContain('SourceImportPanel');
    expect(page).toContain('GebiedsvoorkeurenPanel');
  });

  it('behoudt de bestaande quickscan-sortering', () => {
    expect(page).toContain('sortQuickscansByLatestActivity');
  });

  it('gebruikt de bestaande case- en objectroutes in het previewpaneel', () => {
    const preview = source('src/components/vastgoedrekenen/workspace/ProjectenCasesSectie.tsx');
    expect(preview).toContain('buildQuickscanObjectHref(item.object_id, item.id)');
    expect(preview).toContain('`/objecten/${item.object_id}`');
    expect(preview).toContain('Open volledige case');
    expect(preview).toContain('Open object');
    expect(preview).toContain('aria-label="Preview sluiten"');
  });
});

describe('Vastgoedrekenen werkruimte — layoutvoorkeuren', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('geeft de standaardlayout terug zonder opgeslagen voorkeuren', () => {
    expect(loadLayoutPrefs()).toEqual(VR_DEFAULT_LAYOUT);
  });

  it('slaat verbergen op en herstelt de standaardlayout', () => {
    const verborgen = toggleWidget(loadLayoutPrefs(), 'recent');
    saveLayoutPrefs(verborgen);
    expect(window.localStorage.getItem(VR_LAYOUT_STORAGE_KEY)).toBeTruthy();
    expect(visibleWidgets(loadLayoutPrefs())).not.toContain('recent');

    const hersteld = resetLayoutPrefs();
    expect(hersteld).toEqual(VR_DEFAULT_LAYOUT);
    expect(window.localStorage.getItem(VR_LAYOUT_STORAGE_KEY)).toBeNull();
  });

  it('verplaatst widgets en normaliseert onvolledige opslag', () => {
    const verplaatst = moveWidget(VR_DEFAULT_LAYOUT, 'recent', -1);
    expect(verplaatst.order[0]).toBe('recent');
    expect(moveWidget(VR_DEFAULT_LAYOUT, 'statistieken', -1)).toEqual(VR_DEFAULT_LAYOUT);

    const genormaliseerd = normalizeLayoutPrefs({ order: ['snelacties', 'onbekend'], hidden: ['x'] });
    expect(genormaliseerd.order[0]).toBe('snelacties');
    expect(genormaliseerd.order).toHaveLength(3);
    expect(genormaliseerd.hidden).toEqual([]);
  });
});
