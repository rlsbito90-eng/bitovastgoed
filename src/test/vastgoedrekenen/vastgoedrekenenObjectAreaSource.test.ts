import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/vastgoedrekenen/VastgoedrekenenTab.tsx'),
  'utf8',
);

describe('BUILD O2 — centrale m²-bron Vastgoedrekenen', () => {
  it('gebruikt dezelfde getBerekenM2Bron-helper als Financieel', () => {
    expect(source).toContain("import { getBerekenM2Bron } from '@/lib/derivations';");
    expect(source).toContain('getBerekenM2Bron(object, (object as { type?: string | null }).type ?? null).m2');
  });

  it('geeft de canonieke objectoppervlakte door aan de rekenwerkruimte', () => {
    expect(source).toContain('objectArea={canonicalObjectArea}');
  });

  it('behoudt alleen de bestaande objectArea als fallback als het object niet beschikbaar is', () => {
    expect(source).toContain(': objectArea;');
  });
});
