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
    expect(source).toContain('Archiveer deal');
    expect(source).not.toContain('Deal verwijderen?');
    expect(source).not.toContain('Trash2');
    expect(source).not.toContain('handleDelete');
  });

  it('presenteert een oude Deal-relatie niet automatisch als koper', () => {
    const source = read('src/pages/DealDetailPage.tsx');
    expect(source).toContain('legacyRelatieIsEigenaar');
    expect(source).toContain('Verkoper / eigenaar · legacy');
    expect(source).toContain('Oude Deal-relatie · legacy');
    expect(source).toContain("relatieId: isTransactionPosition ? deal.relatieId : undefined");
    expect(source).toContain('Legacy Deal-record');
  });

  it('gebruikt op Deals-lijst alleen concrete transacties als actieve Deals', () => {
    const source = read('src/pages/DealsPage.tsx');
    expect(source).toContain('TrajectoryStageBadge');
    expect(source).toContain('Trajectfase');
    expect(source).toContain('aantalLegacy');
    expect(source).toContain("archiefView === 'actief' && (d.isArchived || !concreteForDeal(d))");
    expect(source).not.toContain('<DealFaseBadge');
    expect(source).not.toContain('d.fase === faseFilter');
  });

  it('laat de Object-cockpit alleen een concrete Deal gebruiken na de transactiedrempel', () => {
    const source = read('src/pages/ObjectDetailPage.tsx');
    expect(source).toContain('hasTransactionPosition && activeDealRecords.length === 1');
    expect(source).toContain('TrajectoryStageBadge objectId={object.id}');
    expect(source).toContain('Transactie cockpit');
    expect(source).not.toContain('DealFaseBadge');
    expect(source).not.toContain('selectLeadDeal');
  });

  it('bouwt dashboardmomentum op Object Pipeline en niet op deal.fase', () => {
    const source = read('src/pages/DashboardPage.tsx');
    expect(source).toContain('Object Pipeline momentum');
    expect(source).toContain('concreteDeals');
    expect(source).toContain('pipelineStageId === stage.id');
    expect(source).toContain('getTrajectoryProbability(stage)');
    expect(source).not.toContain('pipelineFases');
    expect(source).not.toContain('FASE_KANS[d.fase]');
    expect(source).not.toContain('DEAL_FASE_LABELS[fase]');
  });

  it('gebruikt ook Rapportage voor pipeline en weging de Object Pipeline', () => {
    const source = read('src/pages/RapportagePage.tsx');
    expect(source).toContain('useUnifiedFeeReporting');
    expect(source).toContain('pipelineStageId === stage.id');
    expect(source).toContain('getTrajectoryProbability(stage)');
    expect(source).not.toContain('FASE_VOLGORDE');
    expect(source).not.toContain('DEAL_FASE_LABELS');
    expect(source).not.toContain('conversiePct');
    expect(source).not.toContain('leads →');
    expect(source).toContain('Huidige verdeling van actieve objecten');
  });

  it('filtert Relatie-detail naar concrete of terminale Deals', () => {
    const source = read('src/pages/RelatieDetailPage.tsx');
    expect(source).toContain('isConcreteTransactionPosition');
    expect(source).toContain('TrajectoryStageBadge');
    expect(source).not.toContain('DealFaseBadge');
  });

  it('maakt Geen volgende actie app-breed leesbaar in warning-kleur', () => {
    const source = read('src/components/GeenActieBadge.tsx');
    expect(source).toContain('text-warning border-warning/40');
    expect(source).toContain('font-semibold');
    expect(source).toContain('whitespace-nowrap');
    expect(source).not.toContain('text-warning-foreground');
  });
});
