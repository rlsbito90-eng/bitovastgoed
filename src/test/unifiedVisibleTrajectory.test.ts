import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('één zichtbare commerciële trajectfase', () => {
  it('toont op Deal-detail de Object Pipeline en niet de legacy Deal-fase', () => {
    const source = read('src/pages/DealDetailPage.tsx');
    expect(source).toContain('TrajectoryStageBadge');
    expect(source).toContain('label="Trajectfase"');
    expect(source).not.toContain('DEAL_FASE_LABELS[deal.fase]');
    expect(source).not.toContain('FASE_KANS[deal.fase]');
    expect(source).not.toContain('DealKandidatenSectie');
  });

  it('presenteert een oude Deal-relatie niet automatisch als koper', () => {
    const source = read('src/pages/DealDetailPage.tsx');
    expect(source).toContain('legacyRelatieIsEigenaar');
    expect(source).toContain('Verkoper / eigenaar · legacy');
    expect(source).toContain('Oude Deal-relatie · legacy');
    expect(source).toContain("relatieId: isTransactionPosition ? deal.relatieId : undefined");
  });

  it('gebruikt op Deals-lijst de Object Pipeline als zichtbare fase', () => {
    const source = read('src/pages/DealsPage.tsx');
    expect(source).toContain('TrajectoryStageBadge');
    expect(source).toContain('Trajectfase');
    expect(source).not.toContain('<DealFaseBadge');
    expect(source).not.toContain('d.fase === faseFilter');
  });

  it('maakt Geen volgende actie app-breed leesbaar in warning-kleur', () => {
    const source = read('src/components/GeenActieBadge.tsx');
    expect(source).toContain('text-warning border-warning/40');
    expect(source).toContain('font-semibold');
    expect(source).not.toContain('text-warning-foreground');
  });
});
