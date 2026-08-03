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

  it('toont de bronwaarden met fallback en read-only toelichting', () => {
    expect(page).toContain("{kans.bagPandId||'Niet gekoppeld'}");
    expect(page).toContain("{kans.bagVerblijfsobjectId||'Niet gekoppeld'}");
    expect(page).toContain(
      'BAG-identifiers worden uit de bronkoppeling overgenomen en zijn hier niet vrij wijzigbaar.',
    );
  });

  it('houdt de identifiers buiten de bewerkbare formstate', () => {
    expect(page).not.toContain("bagPandId:kans.bagPandId");
    expect(page).not.toContain("bagVerblijfsobjectId:kans.bagVerblijfsobjectId");
  });
});
