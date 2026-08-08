import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
  resolve(process.cwd(), 'src/pages/VastgoedkansDetailPage.tsx'),
  'utf8',
);

describe('Vastgoedkans BAG-identifiers zijn read-only', () => {
  it('heeft geen onChange meer op de BAG-identifiers', () => {
    expect(page).not.toContain('bagPandId:e.target.value');
    expect(page).not.toContain('bagVerblijfsobjectId:e.target.value');
    expect(page).not.toMatch(/value=\{form\.bagPandId/);
    expect(page).not.toMatch(/value=\{form\.bagVerblijfsobjectId/);
  });

  it('toont de bronwaarden met fallback als read-only tekst', () => {
    expect(page).toMatch(/\{\s*kans\.bagPandId\s*\|\|\s*'Niet gekoppeld'\s*\}/);
    expect(page).toMatch(/\{\s*kans\.bagVerblijfsobjectId\s*\|\|\s*'Niet gekoppeld'\s*\}/);
    expect(page).toContain('BAG-pand-ID');
    expect(page).toContain('BAG-verblijfsobject-ID');
  });

  it('houdt de identifiers buiten de bewerkbare formstate', () => {
    expect(page).not.toContain("bagPandId:kans.bagPandId");
    expect(page).not.toContain("bagVerblijfsobjectId:kans.bagVerblijfsobjectId");
  });
});
