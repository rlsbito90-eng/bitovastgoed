// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    objecten: [], deals: [], relaties: [], pipelineKandidaten: [], contactpersonen: [],
    getJaarDoel: () => null, getObjectById: () => undefined, getRelatieById: () => undefined,
  }),
}));
vi.mock('@/hooks/useUnifiedFeeReporting', () => ({
  useUnifiedFeeReporting: () => ({ rows: [], stats: { gerealiseerdBedrag: 0, pipelineBedrag: 0, gerealiseerdAantal: 0, pipelineAantal: 0 }, error: null, loading: false }),
}));

import CommissieWidget from './CommissieWidget';

describe('CommissieWidget — link naar Rapportage', () => {
  it('toont standaard "Volledige rapportage"', () => {
    render(<MemoryRouter><CommissieWidget /></MemoryRouter>);
    expect(screen.getByText('Volledige rapportage').closest('a')?.getAttribute('href')).toBe('/rapportage');
  });

  it('verbergt de link binnen Rapportage; de rest blijft', () => {
    render(<MemoryRouter><CommissieWidget toonRapportageLink={false} /></MemoryRouter>);
    expect(screen.queryByText('Volledige rapportage')).toBeNull();
    expect(screen.getByText(/Successen & commissie/)).toBeTruthy();
  });
});
