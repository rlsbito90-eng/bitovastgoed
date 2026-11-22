// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  floatingActionOverlayOpen,
  hasGlobalQuickTaskDock,
  hasInlineQuickTaskBar,
} from '@/lib/ui/floatingControls';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CRM-breed: zwevende bediening blokkeert geen paginering', () => {
  it('heeft precies één taakbalk per scherm en dezelfde regel voor de scrollruimte', () => {
    for (const pathname of [
      '/relaties', '/relaties/abc', '/objecten', '/deals',
      '/zoekprofielen', '/vastgoedkansen', '/off-market',
    ]) {
      expect(hasGlobalQuickTaskDock(pathname)).toBe(true);
      expect(hasInlineQuickTaskBar(pathname)).toBe(false);
    }
    for (const pathname of ['/', '/taken', '/taken/abc']) {
      expect(hasGlobalQuickTaskDock(pathname)).toBe(false);
    }
    expect(hasInlineQuickTaskBar('/taken')).toBe(true);
    expect(hasInlineQuickTaskBar('/taken/abc')).toBe(false);
  });

  it('verbergt de pijl zodra een globale taakbalk wordt uitgeklapt', () => {
    const dock = document.createElement('div');
    dock.setAttribute('data-testid', 'quick-task-capture-dock');
    dock.setAttribute('data-expanded', 'false');
    document.body.appendChild(dock);
    expect(floatingActionOverlayOpen()).toBe(false);

    dock.setAttribute('data-expanded', 'true');
    expect(floatingActionOverlayOpen()).toBe(true);

    dock.setAttribute('data-expanded', 'false');
    expect(floatingActionOverlayOpen()).toBe(false);
  });

  it('verbergt de pijl ook wanneer een formulier- of bevestigingspopup openstaat', () => {
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('data-state', 'open');
    document.body.appendChild(modal);
    expect(floatingActionOverlayOpen()).toBe(true);

    modal.setAttribute('data-state', 'closed');
    expect(floatingActionOverlayOpen()).toBe(false);

    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('data-state', 'open');
    expect(floatingActionOverlayOpen()).toBe(true);
  });

  it('reserveert onder iedere standaard CRM-pagina scrollbare mobiele eindruimte', () => {
    const layout = source('src/components/AppLayout.tsx');
    expect(layout).toContain('hasGlobalQuickTaskDock(location.pathname)');
    expect(layout).toContain('!hasInlineQuickTaskBar(location.pathname)');
    expect(layout).toContain('data-testid="crm-floating-controls-clearance"');
    expect(layout).toContain('aria-hidden="true"');
    expect(layout).toContain('pointer-events-none shrink-0 sm:hidden');
    expect(layout).toContain('h-[calc(7.5rem+env(safe-area-inset-bottom))]');
    expect(layout).toContain('h-[calc(4.5rem+env(safe-area-inset-bottom))]');
    expect(layout.indexOf('<PullToRefresh>{children}</PullToRefresh>'))
      .toBeLessThan(layout.indexOf('data-testid="crm-floating-controls-clearance"'));
    expect(layout.indexOf('data-testid="crm-floating-controls-clearance"'))
      .toBeLessThan(layout.indexOf('</main>'));
  });

  it('zet de pijl op tablets naast + Taak en op Taken boven de eigen taakinvoer', () => {
    const nav = source('src/components/DynamicSectionNavigator.tsx');
    const dock = source('src/components/tasks/QuickTaskCaptureDock.tsx');
    const css = source('src/quick-task-glass.css');
    expect(nav).toContain('!floatingActionOverlayOpen()');
    expect(nav).toContain("'data-expanded'");
    expect(nav).toContain('data-testid="dynamic-section-navigator"');
    expect(nav).toContain('sm:right-[10.5rem]');
    expect(nav).toContain('bottom-[calc(env(safe-area-inset-bottom)+6.5rem)]');
    expect(dock).toContain("data-expanded={open ? 'true' : 'false'}");
    expect(dock).toContain('hasGlobalQuickTaskDock(location.pathname)');
    expect(css).toContain('padding-bottom: calc(10.5rem + env(safe-area-inset-bottom));');
  });

  it('behoudt navigatie-acties en bestaande iPhone sticky scrollgrenzen', () => {
    const nav = source('src/components/DynamicSectionNavigator.tsx');
    const app = source('src/components/AppLayout.tsx');
    expect(nav).toContain('function handleClick()');
    expect(nav).toContain('scrollTo(container, targetTop)');
    expect(nav).toContain('getCandidateSections()');
    expect(app).toContain('useTaskPageScrollBoundary(mainScrollRef, boundedPage)');
    expect(app).toContain('data-task-scroll-boundary={isTaskPage ? "true" : undefined}');
    expect(app).toContain('data-relatie-scroll-boundary={isRelatiePage ? "true" : undefined}');
  });
});
