import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ComponentStrategyTable from '@/components/vastgoedrekenen/ComponentStrategyTable';

vi.mock('@/components/vastgoedrekenen/ComponentStrategyTableLegacy', () => ({
  default: () => <div>strategie-editor</div>,
}));
vi.mock('@/components/vastgoedrekenen/ComponentAllocationValuationSummary', () => ({
  default: () => <div>allocatie-overzicht</div>,
}));
vi.mock('@/components/vastgoedrekenen/ComponentAllocationTimingWorkspace', () => ({
  default: () => <div>timing-werkblad</div>,
}));
vi.mock('@/components/vastgoedrekenen/ComponentPeriodicCashflowWorkspace', () => ({
  default: () => <div>componentkasstroom-werkblad</div>,
}));
vi.mock('@/components/vastgoedrekenen/ScenarioUnleveredCashflowWorkspace', () => ({
  default: () => <div>scenariokasstroom-werkblad</div>,
}));
vi.mock('@/components/vastgoedrekenen/ScenarioDcfWorkspace', () => ({
  default: () => <div>rendement-werkblad</div>,
}));
vi.mock('@/components/vastgoedrekenen/ScenarioFinancingWorkspace', () => ({
  default: () => <div>financiering-werkblad</div>,
}));
vi.mock('@/components/vastgoedrekenen/PlainLanguageHelp', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

const props = {
  units: [],
  components: [],
  onCreate: vi.fn().mockResolvedValue(undefined),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onImport: vi.fn().mockResolvedValue(undefined),
};

describe('ComponentStrategyTable scenario navigation', () => {
  it('toont standaard alleen strategie en allocatie', () => {
    render(<ComponentStrategyTable {...props} />);

    expect(screen.getByText('strategie-editor')).toBeInTheDocument();
    expect(screen.getByText('allocatie-overzicht')).toBeInTheDocument();
    expect(screen.queryByText('timing-werkblad')).not.toBeInTheDocument();
    expect(screen.queryByText('rendement-werkblad')).not.toBeInTheDocument();
    expect(screen.queryByText('financiering-werkblad')).not.toBeInTheDocument();
  });

  it('wisselt naar elk afzonderlijk werkblad zonder de lange totaalpagina te tonen', () => {
    render(<ComponentStrategyTable {...props} />);

    fireEvent.click(screen.getByRole('tab', { name: /2 timing/i }));
    expect(screen.getByText('timing-werkblad')).toBeInTheDocument();
    expect(screen.queryByText('strategie-editor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /3 kasstroom/i }));
    expect(screen.getByText('componentkasstroom-werkblad')).toBeInTheDocument();
    expect(screen.getByText('scenariokasstroom-werkblad')).toBeInTheDocument();
    expect(screen.queryByText('timing-werkblad')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /4 rendement/i }));
    expect(screen.getByText('rendement-werkblad')).toBeInTheDocument();
    expect(screen.queryByText('componentkasstroom-werkblad')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /5 financiering/i }));
    expect(screen.getByText('financiering-werkblad')).toBeInTheDocument();
    expect(screen.queryByText('rendement-werkblad')).not.toBeInTheDocument();
  });
});
