import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/bag-query-service/index.ts'),
  'utf-8',
);

describe('Pandenverkenner 2.0 transportgrens', () => {
  it('behoudt de bestaande search-route als fallback', () => {
    expect(source).toContain("if (body.action === 'search')");
    expect(source).toContain('bag_service.zoek_panden(${scope}, ${cursor}, ${limit})');
  });

  it('introduceert search_v2 zonder de oude route te vervangen', () => {
    expect(source).toContain("if (body.action === 'search_v2')");
    expect(source).toContain('bag_service.zoek_panden_v2(');
  });

  it('houdt scope, auth en bag_reader-grens intact', () => {
    expect(source).toContain("await tx.unsafe('SET LOCAL ROLE bag_reader')");
    expect(source).toContain('const scope = scopeCode(body.scopeCode)');
    expect(source).toContain('await authorize(req)');
  });

  it('valideert v2-filterbereiken vóór database-executie', () => {
    expect(source).toContain('Ongeldig bouwjaarbereik');
    expect(source).toContain('Ongeldig VBO-sombereik');
    expect(source).toContain('Ongeldig VBO-maxbereik');
    expect(source).toContain('Ongeldig VBO-aantalbereik');
    expect(source).toContain('Ongeldige VBO-modus');
  });

  it('ondersteunt de kernfilters van Fase 1C', () => {
    for (const veld of [
      'bouwjaarVan',
      'bouwjaarTot',
      'status',
      'vboOppervlakteSomVan',
      'vboOppervlakteSomTot',
      'vboOppervlakteMaxVan',
      'vboOppervlakteMaxTot',
      'vboAantalVan',
      'vboAantalTot',
      'gebruiksdoel',
      'isGemengd',
      'vboModus',
    ]) {
      expect(source).toContain(`body.${veld}`);
    }
  });
});
