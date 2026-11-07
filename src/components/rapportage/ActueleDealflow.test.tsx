// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const stage = (id: string, slug: string, name: string, sortOrder: number) =>
  ({ id, slug, name, sortOrder, isActive: true, isLost: false, probability: 50 });
const stages = [stage('s1', 'matching', 'Matching', 1), stage('s2', 'preferred_bidder', 'Preferred bidder', 5), stage('s3', 'koopovereenkomst', 'Koopovereenkomst', 7)];
const objecten = [
  { id: 'o1', titel: 'Kantoor Breda', plaats: 'Breda', vraagprijs: 2_000_000, pipelineStageId: 's3', status: 'onder_optie' },
  { id: 'o2', titel: 'Winkel Tilburg', plaats: 'Tilburg', vraagprijs: 900_000, pipelineStageId: 's1', status: 'beschikbaar' },
];
const relaties = [{ id: 'r1', bedrijfsnaam: 'Koper BV', leadStatus: 'warm' }];
const deals = [
  { id: 'd1', objectId: 'o1', relatieId: 'r1', fase: 'onderhandeling', commissieBedrag: 30_000 },
  { id: 'd2', objectId: 'o2', relatieId: 'r1', fase: 'bezichtiging', commissieBedrag: 10_000 },
];
const store = {
  relaties, objecten, deals, zoekprofielen: [], pipelineKandidaten: [], contactpersonen: [],
  getDefaultObjectPipeline: () => ({ id: 'p' }),
  getStagesVoorPipeline: () => stages,
  getObjectById: (id: string) => objecten.find(o => o.id === id),
  getRelatieById: (id: string) => relaties.find(r => r.id === id),
};

vi.mock('@/hooks/useDataStore', () => ({ useDataStore: () => store }));
vi.mock('@/hooks/useUnifiedFeeReporting', () => ({ useUnifiedFeeReporting: () => ({ rows: [], stats: {}, error: null, loading: false }) }));
vi.mock('@/hooks/useAcquisitie', () => ({ useAcquisitie: () => ({ targets: [], campagnes: [] }) }));
vi.mock('@/components/dashboard/CommissieWidget', () => ({ default: () => <div data-testid="commissie-widget" /> }));
vi.mock('@/components/pipeline/TrajectoryStageBadge', () => ({ default: ({ objectId }: { objectId: string }) => <span data-testid={`fase-${objectId}`} /> }));
vi.mock('@/lib/lifecycle/trajectory', () => ({
  getPreferredBidderStage: (s: typeof stages) => s.find(x => x.slug === 'preferred_bidder'),
  getTrajectoryStage: (o: { pipelineStageId: string } | undefined) => stages.find(x => x.id === o?.pipelineStageId),
  getTrajectoryProbability: () => 0.5,
  isConcreteTransactionPosition: (st: { sortOrder: number } | undefined, pb: { sortOrder: number } | undefined) => !!st && !!pb && st.sortOrder >= pb.sortOrder,
}));

import ActueleDealflow from './ActueleDealflow';

describe('ActueleDealflow (Rapportage)', () => {
  it('toont de zes verhuisde onderdelen', () => {
    render(<MemoryRouter><ActueleDealflow /></MemoryRouter>);
    for (const titel of ['Object Pipeline momentum', 'Concrete transacties', 'Dealflow health', 'Fee forecast', 'Acquisitie']) {
      expect(screen.getAllByText(titel).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId('commissie-widget')).toBeTruthy();
    expect(screen.queryByText('Nieuwe kansen')).toBeNull();
  });

  it('concrete transacties: alleen vanaf Preferred bidder, met object, koper, plaats, prijs, fee en link naar de deal', () => {
    render(<MemoryRouter><ActueleDealflow /></MemoryRouter>);
    const rij = screen.getByText('Kantoor Breda').closest('a');
    expect(rij?.getAttribute('href')).toBe('/deals/d1');
    expect(rij?.textContent).toContain('Breda');
    expect(rij?.textContent).toContain('fee');
    expect(screen.getByTestId('fase-o1')).toBeTruthy();
    expect(screen.getByText('1 van 1 — vanaf Preferred bidder / exclusiviteit')).toBeTruthy();
    expect(screen.queryByTestId('fase-o2')).toBeNull();
  });
});
