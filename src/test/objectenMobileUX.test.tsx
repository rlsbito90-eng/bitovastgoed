// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isObjectPageScrollRoute } from '@/hooks/useTaskPageScrollBoundary';
import { shouldBlockModalTouch } from '@/hooks/useModalScrollContainment';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const detail = source('src/pages/ObjectDetailPage.tsx');
const quick = source('src/components/forms/ObjectQuickCreateDialog.tsx');
const full = source('src/components/forms/ObjectFormDialog.tsx');
const layout = source('src/components/AppLayout.tsx');

describe('Objecten: compacte iPhone detailpagina en vaste form-acties', () => {
  it('begrenst verticale rubber-band op objectlijst en -detail, zonder andere routes te wijzigen', () => {
    expect(isObjectPageScrollRoute('/objecten')).toBe(true);
    expect(isObjectPageScrollRoute('/objecten/')).toBe(true);
    expect(isObjectPageScrollRoute('/objecten/object-123')).toBe(true);
    expect(isObjectPageScrollRoute('/objecten/object-123/')).toBe(true);
    for (const path of ['/', '/taken', '/relaties', '/objecten/123/media', '/objecten-overzicht']) {
      expect(isObjectPageScrollRoute(path)).toBe(false);
    }
    expect(layout).toContain('const boundedPage = isTaskPage || isRelatiePage || isObjectPage;');
    expect(layout).toContain('data-object-scroll-boundary={isObjectPage ? "true" : undefined}');
    expect(layout).toContain('useTaskPageScrollBoundary(mainScrollRef, boundedPage)');
  });

  it('laat normaal scrollen toe en voorkomt zijwaarts bewegen en overscroll in objectformulieren', () => {
    const middle = { scrollTop: 80, scrollHeight: 1200, clientHeight: 420 };
    expect(shouldBlockModalTouch({ ...middle, totalX: 3, totalY: -65, stepY: -25 })).toBe(false);
    expect(shouldBlockModalTouch({ ...middle, totalX: 55, totalY: 5, stepY: 5 })).toBe(true);
    expect(shouldBlockModalTouch({ ...middle, totalX: 0, totalY: 42, stepY: 15, scrollTop: 0 })).toBe(true);
    expect(shouldBlockModalTouch({ ...middle, totalX: 0, totalY: -42, stepY: -15, scrollTop: 780 })).toBe(true);
  });

  it('toont de objecttabs direct onder de kop, vóór KPI’s en dossiercontrole', () => {
    const tabs = detail.indexOf('<WorkspaceTabsNav tabs={visibleTabs}');
    const kpis = detail.indexOf('HERO KPI STRIP');
    const progress = detail.indexOf('<DossierProgress');
    expect(tabs).toBeGreaterThan(0);
    expect(tabs).toBeLessThan(kpis);
    expect(kpis).toBeLessThan(progress);
    expect(detail.match(/<WorkspaceTabsNav tabs=/g)).toHaveLength(1);
    expect(detail).toContain('className="sticky top-0 z-20');
  });

  it('verbergt uitsluitend de lege fotobanner op mobiel; foto en metadata blijven intact', () => {
    expect(detail).toContain('heroUrl ? "" : "hidden sm:block"');
    expect(detail).toContain('data-testid="object-hero-image"');
    expect(detail).toContain('{badgesBlock}');
    expect(detail).toContain('{titleBlock}');
    expect(detail).toContain('{actionsBlockMobile}');
    expect(detail).not.toContain('lg:hidden h-[40vh]');
    expect(detail).toContain('<ObjectClassificatieInline object={object}');
    expect(detail).toContain('<ObjectKerngegevensInline object={object}');
    expect(detail).toContain('onSave={(patch)=>store.updateObject(object.id,patch)}');
  });

  it('houdt bij snel aanmaken de knoppen en kop vast en alleen inhoud scrollbaar', () => {
    expect(quick).toContain('useModalScrollContainment(bodyScrollRef, open)');
    expect(quick).toContain('data-testid="quick-object-form-scroll"');
    expect(quick).toContain('overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y');
    expect(quick).toContain('h-[min(88svh,780px)]');
    expect(quick).toContain('safe-area-inset-bottom');
    expect(quick).toContain('style={{ paddingBottom: 0 }}');
    expect(quick.indexOf('data-testid="quick-object-form-scroll"')).toBeLessThan(quick.indexOf('<DialogFooter className='));
    expect(quick).toContain('Object aanmaken');
    expect(quick).toContain('eigenaarRelatieId: relatieId || undefined');
  });

  it('houdt tabs en opslaan van het uitgebreide objectformulier zichtbaar op iPhone', () => {
    expect(full).toContain('useModalScrollContainment(scrollRef, open)');
    expect(full).toContain('useResetScrollOnChange(tab)');
    expect(full).toContain('h-[min(88svh,850px)]');
    expect(full).toContain('style={{ paddingBottom: 0 }}');
    expect(full).toContain('data-testid="object-full-form-scroll"');
    expect(full).toContain('overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y');
    expect(full).toContain('safe-area-inset-bottom');
    expect(full.indexOf('<TabsList')).toBeLessThan(full.indexOf('data-testid="object-full-form-scroll"'));
    expect(full.indexOf('data-testid="object-full-form-scroll"')).toBeLessThan(full.indexOf('onClick={handleSave}'));
    expect(full).toContain('disabled={!objectId}');
    expect(full).toContain('<TabsTrigger value="media"');
    expect(full).toContain('onClick={handleSave}');
  });
});
