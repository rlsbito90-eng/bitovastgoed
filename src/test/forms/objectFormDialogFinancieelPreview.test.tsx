// Fase 2C-1 — Auto/delta-preview + NOI/NAR-toelichting in ObjectFormDialog
//
// Verifieert dat handmatige overrides op BAR en Huur/m² een compact
// muted regeltje `auto: X · Δ Y` tonen; dat het warning-icoon alleen
// verschijnt boven de gedefinieerde tolerantie; en dat NOI/NAR bewust
// geen automatische afleiding suggereren.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
import type { ObjectVastgoed } from '@/data/mock-data';

// --- Mocks voor zware afhankelijkheden --------------------------------

const updateObjectMock = vi.fn();
const addObjectMock = vi.fn();

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    addObject: addObjectMock,
    updateObject: updateObjectMock,
    objecten: [],
    genereerRefnummer: async () => 'REF-2C1-TEST',
  }),
}));

vi.mock('@/hooks/usePropertyTaxonomie', () => ({
  usePropertyTaxonomie: () => ({
    propertyTypes: [],
    subtypesForType: () => [],
    dealTypes: [],
    propertyTypeById: () => undefined,
  }),
}));

vi.mock('@/components/object/SubcategorieSelect', () => ({
  default: () => <div data-testid="subcat-select" />,
}));
vi.mock('@/components/object/HuurdersPanel', () => ({
  default: () => <div data-testid="huurders-panel" />,
}));
vi.mock('@/components/object/DocumentenPanel', () => ({
  default: () => <div data-testid="documenten-panel" />,
}));
vi.mock('@/components/object/FotosPanel', () => ({
  default: () => <div data-testid="fotos-panel" />,
}));
vi.mock('@/components/object/MultiSelectChips', () => ({
  default: () => <div data-testid="multi-select-chips" />,
}));
vi.mock('@/components/ArchiveerDialog', () => ({
  default: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

// --- Helpers ----------------------------------------------------------

function baseObject(overrides: Partial<ObjectVastgoed> = {}): ObjectVastgoed {
  return {
    id: 'obj-2c1',
    titel: 'Testobject 2C-1',
    plaats: 'Amsterdam',
    provincie: 'Noord-Holland',
    type: 'kantoor',
    status: 'te_koop',
    aanbiedingswijze: 'on_market',
    anoniem: false,
    verhuurStatus: 'verhuurd',
    exclusief: false,
    isPortefeuille: false,
    ontwikkelPotentie: false,
    transformatiePotentie: false,
    asbestinventarisatieAanwezig: false,
    datumToegevoegd: '2026-01-01',
    // Financials:
    vraagprijs: 1_000_000,
    huurinkomsten: 60_000,
    oppervlakteGbo: 500,
    ...overrides,
  } as ObjectVastgoed;
}

function renderDialog(object: ObjectVastgoed) {
  return render(
    <MemoryRouter>
      <ObjectFormDialog
        open
        onOpenChange={() => {}}
        object={object}
        initialTab="financieel"
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  updateObjectMock.mockReset();
  addObjectMock.mockReset();
});

// --- BAR --------------------------------------------------------------

describe('Fase 2C-1 — BAR override-preview', () => {
  it('BAR handmatig + autoBar beschikbaar → auto/delta-regel zichtbaar', () => {
    // auto = 60000/1_000_000*100 = 6,00 %; handmatig 5,50 → Δ -0,50
    renderDialog(baseObject({ brutoAanvangsrendement: 5.5 }));
    const delta = screen.getByTestId('bar-delta');
    expect(delta.textContent).toMatch(/auto:\s*6,00\s*%/);
    expect(delta.textContent).toMatch(/Δ\s*−0,50\s*%/);
  });

  it('BAR zonder handmatige override → geen delta-regel', () => {
    renderDialog(baseObject({ brutoAanvangsrendement: undefined }));
    expect(screen.queryByTestId('bar-delta')).toBeNull();
  });

  it('BAR afwijking ≤ 0,2 procentpunt → geen warning-icoon', () => {
    // auto = 6, handmatig 6,15 → Δ 0,15 ≤ 0,2
    renderDialog(baseObject({ brutoAanvangsrendement: 6.15 }));
    expect(screen.getByTestId('bar-delta')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-mismatch')).toBeNull();
  });

  it('BAR afwijking > 0,2 procentpunt → warning-icoon zichtbaar', () => {
    // auto = 6, handmatig 5,50 → Δ 0,50 > 0,2
    renderDialog(baseObject({ brutoAanvangsrendement: 5.5 }));
    expect(screen.getByTestId('bar-mismatch')).toBeInTheDocument();
  });
});

// --- Huur / m² --------------------------------------------------------

describe('Fase 2C-1 — Huur/m² override-preview', () => {
  it('handmatig + autoHuurPerM2 beschikbaar → auto/delta-regel zichtbaar', () => {
    // auto = 60000/500 = 120 €/m²; handmatig 135 → Δ +15
    renderDialog(baseObject({ huurPerM2: 135 }));
    const delta = screen.getByTestId('huurperm2-delta');
    expect(delta.textContent).toMatch(/auto:/);
    expect(delta.textContent).toMatch(/Δ\s*\+€\s*15/);
  });

  it('afwijking ≤ max(1% van auto, €2/m²) → geen warning-icoon', () => {
    // auto = 120, tolerantie = max(1,20, 2) = 2 → 121 valt binnen
    renderDialog(baseObject({ huurPerM2: 121 }));
    expect(screen.getByTestId('huurperm2-delta')).toBeInTheDocument();
    expect(screen.queryByTestId('huurperm2-mismatch')).toBeNull();
  });

  it('afwijking > max(1% van auto, €2/m²) → warning-icoon zichtbaar', () => {
    // auto = 120, tolerantie = 2; 135 - 120 = 15 > 2
    renderDialog(baseObject({ huurPerM2: 135 }));
    expect(screen.getByTestId('huurperm2-mismatch')).toBeInTheDocument();
  });

  it('auto-only (geen handmatige override) → geen delta-regel', () => {
    renderDialog(baseObject({ huurPerM2: undefined }));
    expect(screen.queryByTestId('huurperm2-delta')).toBeNull();
  });
});

// --- NOI --------------------------------------------------------------

describe('Fase 2C-1 — NOI toelichting', () => {
  it('toont info-tooltip en handmatig-uitleg, geen automatische servicekosten-berekening', () => {
    renderDialog(baseObject({ servicekostenJaar: 20_000 }));
    expect(screen.getByTestId('noi-info')).toBeInTheDocument();
    const hint = screen.getByTestId('noi-hint');
    expect(hint.textContent).toMatch(/bewust niet automatisch/i);
    expect(hint.textContent).toMatch(/handmatig/i);
    // Placeholder-tekst mag NOI niet als automatisch presenteren.
    expect(hint.textContent).not.toMatch(/huurinkomsten\s*[-−]\s*servicekosten/i);
  });
});

// --- NAR --------------------------------------------------------------

describe('Fase 2C-1 — NAR toelichting', () => {
  it('toont info-tooltip en bevat geen "NOI ÷ vraagprijs" placeholder/copy', () => {
    renderDialog(baseObject());
    expect(screen.getByTestId('nar-info')).toBeInTheDocument();
    const hint = screen.getByTestId('nar-hint');
    expect(hint.textContent).toMatch(/niet automatisch afgeleid/i);
    // Geen suggestie van NOI ÷ vraagprijs meer in de NAR-hint.
    expect(hint.textContent ?? '').not.toMatch(/NOI\s*÷\s*vraagprijs/);
  });
});

// --- Servicekosten ----------------------------------------------------

describe('Fase 2C-1 — Servicekosten-hint', () => {
  it('toont zachte hint dat servicekosten niet automatisch in NOI/NAR meetellen', () => {
    renderDialog(baseObject());
    const hint = screen.getByTestId('servicekosten-hint');
    expect(hint.textContent).toMatch(/doorgaans doorbelast/i);
    expect(hint.textContent).toMatch(/niet automatisch mee in NOI\/NAR/i);
    // Niet de absolute variant.
    expect(hint.textContent).not.toMatch(/zijn geen exploitatiekosten/i);
  });
});

// --- No-write invariant -----------------------------------------------

describe('Fase 2C-1 — geen auto-write bij openen', () => {
  it('opent zonder updateObject/addObject aan te roepen', async () => {
    renderDialog(baseObject({ brutoAanvangsrendement: undefined, huurPerM2: undefined }));
    // Kleine yield voor eventuele effects.
    await userEvent.tab();
    expect(updateObjectMock).not.toHaveBeenCalled();
    expect(addObjectMock).not.toHaveBeenCalled();
  });
});
