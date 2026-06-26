import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'obj-1' }),
  useNavigate: () => mocks.navigate,
  Link: ({ children, ...p }: any) => <a {...p}>{children}</a>,
}));

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    objecten: [],
    relaties: [],
    contactpersonen: [],
    deals: [],
    zoekprofielen: [],
    getObjectById: (id: string) =>
      id === 'obj-1'
        ? {
            id: 'obj-1',
            titel: 'Test Object',
            anoniem: false,
            plaats: 'Amsterdam',
            provincie: 'Noord-Holland',
            status: 'te_beoordelen',
            verhuurStatus: 'verhuurd',
            type: 'bedrijfsvastgoed',
            exclusief: false,
            isArchived: false,
            datumToegevoegd: '2024-01-01',
          }
        : null,
    getFotosVoorObject: () => [],
    getHuurdersVoorObject: () => [],
    getDocumentenVoorObject: () => [],
    getDealsByObject: () => [],
    getTakenByObject: () => [],
    getPipelineVoorObject: () => [],
    getRelatieById: () => null,
  }),
}));

vi.mock('@/hooks/useSubcategorieen', () => ({
  useSubcategorieen: () => ({ labelFor: () => '' }),
}));

vi.mock('@/hooks/usePropertyTaxonomie', () => ({
  usePropertyTaxonomie: () => ({
    propertyTypes: [],
    propertyTypeById: () => null,
    propertySubtypeById: () => null,
    dealTypeById: () => null,
  }),
}));

vi.mock('@/components/object/kadaster/KadasterGebiedsdataKaart', () => ({
  default: () => <div data-testid="kadaster-gebiedsdata" />,
}));

vi.mock('@/components/object/kadaster/KadasterOpgeslagenKaart', () => ({
  default: () => <div data-testid="kadaster-opgeslagen" />,
}));

vi.mock('@/components/object/dossier/ObjectDossierCard', () => ({
  default: () => <div data-testid="dossier-card" />,
}));

vi.mock('@/components/vastgoedrekenen/VastgoedrekenenTab', () => ({
  default: () => <div data-testid="vastgoedrekenen" />,
}));

vi.mock('@/components/biedingen/BiedingenSection', () => ({
  default: () => <div data-testid="biedingen" />,
}));

vi.mock('@/components/pipeline/ObjectPipelineSectie', () => ({
  default: () => <div data-testid="pipeline-sectie" />,
}));

vi.mock('@/components/pipeline/ObjectPipelineFaseSectie', () => ({
  default: () => <div data-testid="pipeline-fase" />,
}));

vi.mock('@/components/object/ObjectReferentieAnalyseSectie', () => ({
  default: () => <div data-testid="referentie-analyse" />,
}));

vi.mock('@/components/TaxonomieBadges', () => ({
  ClassificatieRij: () => <div data-testid="classificatie" />,
}));

vi.mock('@/components/pdf/ObjectPdfButton', () => ({
  default: () => <button>PDF</button>,
}));

vi.mock('@/components/StatusBadges', () => ({
  ObjectStatusBadge: () => <span>Status</span>,
  DealFaseBadge: () => <span>Fase</span>,
  MatchScoreBadge: () => <span>Score</span>,
}));

vi.mock('@/components/contactmoment/Timeline', () => ({
  default: () => <div data-testid="timeline" />,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/hooks/useKadasterDataRecords', () => ({
  useKadasterDataRecords: () => ({ data: [] }),
  laatsteRecordsPerProduct: () => new Map(),
}));

vi.mock('@/hooks/useKadasterDocumenten', () => ({
  useKadasterDocumentenForObject: () => ({ data: [] }),
}));

vi.mock('@/components/GeenActieBadge', () => ({
  default: () => <span>Geen actie</span>,
  isVerlopen: () => false,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('ObjectDetailPage — meer-tab zichtbaarheid met Kadasterdata', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it('toont de "Meer" tab wanneer er Kadasterrecords zijn, zonder juridisch/contacten/deals', async () => {
    vi.doMock('@/hooks/useKadasterDataRecords', () => ({
      useKadasterDataRecords: () => ({
        data: [
          {
            id: 'kd-1',
            object_id: 'obj-1',
            product_code: 'object',
            status: 'geleverd',
            fetched_at: '2024-01-01T00:00:00Z',
            zoekadres: {},
            raw_limited: {},
          },
        ],
      }),
      laatsteRecordsPerProduct: () => new Map(),
    }));

    // Force re-import with new mock
    const { default: ObjectDetailPageFresh } = await import('@/pages/ObjectDetailPage');

    render(<ObjectDetailPageFresh />, { wrapper });

    // The "Meer" tab should be visible because of Kadaster records
    expect(screen.getByRole('button', { name: /Meer/i })).toBeTruthy();
  });

  it('toont de "Meer" tab wanneer er Kadasterdocumenten zijn, zonder juridisch/contacten/deals', async () => {
    vi.doMock('@/hooks/useKadasterDocumenten', () => ({
      useKadasterDocumentenForObject: () => ({
        data: [
          {
            id: 'doc-1',
            object_id: 'obj-1',
            bestandsnaam: 'test.pdf',
            product_codes: ['object'],
            fetched_at: '2024-01-01T00:00:00Z',
            storage_bucket: 'bito-objecten',
            storage_path: 'test.pdf',
            zoekadres: {},
          },
        ],
      }),
    }));

    const { default: ObjectDetailPageFresh } = await import('@/pages/ObjectDetailPage');
    render(<ObjectDetailPageFresh />, { wrapper });

    expect(screen.getByRole('button', { name: /Meer/i })).toBeTruthy();
  });

  it('verbergt de "Meer" tab wanneer er geen juridisch, contacten, deals of Kadasterdata is', () => {
    const ObjectDetailPage = require('@/pages/ObjectDetailPage').default;
    render(<ObjectDetailPage />, { wrapper });

    const meerTab = screen.queryByRole('button', { name: /Meer/i });
    expect(meerTab).toBeNull();
  });
});
