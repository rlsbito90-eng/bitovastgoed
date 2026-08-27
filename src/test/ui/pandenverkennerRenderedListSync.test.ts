import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Pandenverkenner gerenderde lijst', () => {
  it('nummert in de werkelijk gerenderde straatvolgorde vanaf het paginabegin', () => {
    const sync = source('src/lib/bag/pandenverkennerRenderedListSync.ts');
    expect(sync).toContain('bepaalPaginaStart');
    expect(sync).toContain("querySelectorAll<HTMLElement>(RESULTAAT_RIJ_SELECTOR)");
    expect(sync).toContain('String(start + index)');
    expect(sync).toContain('Volgnummer ${nummer}');
  });

  it('markeert geblokkeerde panden en activeert de mobiele selectiebar op echte selectie-state', () => {
    const sync = source('src/lib/bag/pandenverkennerRenderedListSync.ts');
    const css = source('src/mobile-pandenverkenner-selection-state.css');
    const main = source('src/main.tsx');

    expect(sync).toContain('pandenverkennerGeblokkeerd');
    expect(sync).toContain('pandenverkennerSelectiebar');
    expect(sync).toContain("toolbar.dataset.active = wisSelectie.disabled ? 'false' : 'true'");
    expect(css).toContain('[data-pandenverkenner-geblokkeerd="true"]');
    expect(css).toContain('[data-pandenverkenner-selectiebar="true"][data-active="true"]');
    expect(main).toContain('installPandenverkennerRenderedListSync();');
  });
});
