import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Pandenverkenner mobiele pandkaartselectie', () => {
  it('maakt de volledige pandkaart selecteerbaar zonder interactieve acties te kapen', () => {
    const gedrag = source('src/lib/bag/pandenverkennerMobileCardSelection.ts');
    const css = source('src/mobile-pandenverkenner-card-selection.css');
    const main = source('src/main.tsx');

    expect(gedrag).toContain("'(max-width: 640px)'");
    expect(gedrag).toContain('select[aria-label="Sorteer geladen pagina"]');
    expect(gedrag).toContain('event.target.closest(INTERACTIEF_DOEL)');
    expect(gedrag).toContain("checkbox.click()");
    expect(gedrag).toContain("checkbox.disabled");
    expect(css).toContain('cursor: pointer');
    expect(main).toContain('installPandenverkennerMobileCardSelection();');
  });
});
