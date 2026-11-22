// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isRelatiePageScrollRoute } from '@/hooks/useTaskPageScrollBoundary';
import { shouldBlockModalTouch } from '@/hooks/useModalScrollContainment';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const quick = source('src/components/forms/QuickCreateRelationDialog.tsx');
const full = source('src/components/forms/RelatieFormDialog.tsx');
const page = source('src/pages/RelatieDetailPage.tsx');
const layout = source('src/components/AppLayout.tsx');

describe('Relaties UX: stabiele pagina, direct bewerken en vaste acties', () => {
  it('schakelt iPhone-scrollbegrenzing alleen in voor overzicht en relatiedossier', () => {
    expect(isRelatiePageScrollRoute('/relaties')).toBe(true);
    expect(isRelatiePageScrollRoute('/relaties/')).toBe(true);
    expect(isRelatiePageScrollRoute('/relaties/rel-123')).toBe(true);
    expect(isRelatiePageScrollRoute('/relaties/rel-123/')).toBe(true);
    for (const path of ['/', '/taken', '/objecten', '/relaties-extra', '/relaties/a/b']) {
      expect(isRelatiePageScrollRoute(path)).toBe(false);
    }
    expect(layout).toContain('const boundedPage = isTaskPage || isRelatiePage;');
    expect(layout).toContain('useTaskPageScrollBoundary(mainScrollRef, boundedPage)');
    expect(layout).toContain('data-relatie-scroll-boundary={isRelatiePage ? "true" : undefined}');
  });

  it('laat scrollen in de modal toe, maar blokkeert zijwaartse veeg en rubber-band op de rand', () => {
    const middle = { scrollTop: 150, scrollHeight: 850, clientHeight: 320 };
    expect(shouldBlockModalTouch({ ...middle, totalX: 2, totalY: -80, stepY: -20 })).toBe(false);
    expect(shouldBlockModalTouch({ ...middle, totalX: 70, totalY: 5, stepY: 5 })).toBe(true);
    expect(shouldBlockModalTouch({ ...middle, totalX: 0, totalY: 45, stepY: 12, scrollTop: 0 })).toBe(true);
    expect(shouldBlockModalTouch({ ...middle, totalX: 0, totalY: -45, stepY: -12, scrollTop: 530 })).toBe(true);
  });

  it('snel toevoegen heeft een vaste kop, een eigen scrollvlak en vaste primaire acties', () => {
    expect(quick).toContain('useModalScrollContainment(bodyScrollRef, open)');
    expect(quick).toContain('data-testid="quick-relatie-scroll"');
    expect(quick).toContain('overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y');
    expect(quick).toContain('h-[min(88svh,740px)]');
    expect(quick).toContain('safe-area-inset-bottom');
    expect(quick).toContain('style={{ paddingBottom: 0 }}');
    expect(quick.indexOf('data-testid="quick-relatie-scroll"')).toBeLessThan(quick.indexOf('<DialogFooter className='));
    expect(quick).toContain('grid-cols-2 gap-2 border-t border-border');
    expect(quick).toContain('col-span-2 min-w-0 sm:order-2 sm:col-auto');
    expect(quick).toContain('Relatie aanmaken');
    expect(quick).toContain('Opslaan en volgende');
  });

  it('uitgebreid toevoegen heeft vaste tabs en footer, alleen het midden beweegt', () => {
    expect(full).toContain('useModalScrollContainment(tabScrollRef, open)');
    expect(full).toContain('h-[min(88svh,800px)]');
    expect(full).toContain('style={{ paddingBottom: 0 }}');
    expect(full).toContain('data-testid="relatie-form-scroll"');
    expect(full).toContain('overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y');
    expect(full).toContain('safe-area-inset-bottom');
    expect(full.indexOf('data-testid="relatie-form-scroll"')).toBeGreaterThan(full.indexOf('<TabsList'));
    expect(full.indexOf('data-testid="relatie-form-scroll"')).toBeLessThan(full.indexOf('data-testid="relatie-form-sluiten"'));
    expect(full).toContain('if(tabScrollRef.current)tabScrollRef.current.scrollTop=0');
    expect(full).toContain('min-w-0 space-y-1.5');
  });

  it('deelt standaard belegger en BV en wijzigt bestaande relaties niet stilzwijgend', () => {
    expect(quick).toContain('STANDAARD_NIEUWE_RELATIE.partijprofiel');
    expect(quick).toContain('STANDAARD_NIEUWE_RELATIE.rechtsvorm');
    expect(full).toContain('STANDAARD_NIEUWE_RELATIE.partijprofiel');
    expect(full).toContain('STANDAARD_NIEUWE_RELATIE.rechtsvorm');
    expect(full).toContain('partijprofiel:relatie.partijprofiel??null');
  });

  it('behoudt de directe velden in het relatiedossier, zonder een extra bewerkscherm', () => {
    expect(page).toContain('<InlineRelatieClassificatie relatie={relatie}');
    expect(page).toContain('<InlineVastgoedVoorkeuren relatie={relatie}');
    expect(page).toContain('<InlineRelatieSectie titel="Investering en financiering"');
    expect(page).toContain('<InlineRelatieSectie titel="Aankoop, verkoop en notities"');
    expect(page).toContain('store.updateRelatie(relatie.id,p)');
  });
});
