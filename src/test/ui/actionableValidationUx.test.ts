import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('actiegerichte validatie-UX', () => {
  it('toont betrouwbaarheid en bron per algemene kostenpost', () => {
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(editor).toContain('Betrouwbaarheid kostenpost');
    expect(editor).toContain('Bron / onderbouwing');
    expect(editor).toContain('Projectspecifiek gecontroleerd');
  });

  it('biedt klikbare herstelacties en exacte navigatiedoelen', () => {
    const list = source('src/components/vastgoedrekenen/NogTeControleren.tsx');
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(list).toContain('onAction?.(action)');
    expect(editor).toContain('navigateToValidationAction');
    expect(editor).toContain('id={`cost-${c.id}`}');
  });
});
