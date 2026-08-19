import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('mobiele UX fundering', () => {
  it('gebruikt dynamische viewport en safe-area in de app-shell', () => {
    const layout = source('src/components/AppLayout.tsx');
    const css = source('src/mobile-foundation.css');
    expect(layout).toContain('env(safe-area-inset-top)');
    expect(layout).toContain('min-h-0');
    expect(css).toContain('100dvh');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('maakt dialogs, alert-dialogs en sheets mobiel scrollbaar', () => {
    const dialog = source('src/components/ui/dialog.tsx');
    const alertDialog = source('src/components/ui/alert-dialog.tsx');
    const sheet = source('src/components/ui/sheet.tsx');
    expect(dialog).toContain('overflow-y-auto');
    expect(dialog).toContain('100dvh');
    expect(alertDialog).toContain('overflow-y-auto');
    expect(alertDialog).toContain('100dvh');
    expect(sheet).toContain('overflow-y-auto');
    expect(sheet).toContain('100dvh');
  });

  it('borgt touch targets en mobiele form-inputs', () => {
    const buttons = source('src/components/ui/button.tsx');
    const css = source('src/mobile-foundation.css');
    expect(buttons).toContain('h-11 px-4 py-2 sm:h-10');
    expect(buttons).toContain('h-11 w-11 sm:h-10 sm:w-10');
    expect(css).toContain('font-size: 1rem');
    expect(css).toContain('min-height: 2.75rem');
  });

  it('maakt tabs en zware kanban-workflows bruikbaar op smalle schermen', () => {
    const tabs = source('src/components/ui/tabs.tsx');
    const pipeline = source('src/pages/PipelinePage.tsx');
    const css = source('src/mobile-foundation.css');
    expect(tabs).toContain('data-mobile-scroll-row');
    expect(tabs).toContain('overflow-x-auto');
    expect(pipeline).toContain('data-mobile-kanban');
    expect(css).toContain('scroll-snap-type: x mandatory');
  });

  it('houdt page headers en detailmetadata leesbaar op mobiel', () => {
    const header = source('src/components/PageHeader.tsx');
    const css = source('src/mobile-foundation.css');
    expect(header).toContain('data-bito-page-header');
    expect(header).toContain('data-bito-page-actions');
    expect(css).toContain('main .field-label');
    expect(css).toContain('main .field-value');
  });

  it('houdt bulkacties in de acquisitieselectie sticky zodra er items geselecteerd zijn', () => {
    const acquisitie = source('src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx');
    const css = source('src/mobile-foundation.css');
    expect(acquisitie).toContain('data-testid="acquisitie-bulk-toolbar"');
    expect(acquisitie).toContain('data-testid="acquisitie-bulk-telling"');
    expect(css).toContain('[data-testid="acquisitie-bulk-toolbar"]:has([data-testid="acquisitie-bulk-telling"])');
    expect(css).toContain('position: fixed !important');
    expect(css).toContain('padding-bottom: calc(10rem + env(safe-area-inset-bottom))');
  });
});
