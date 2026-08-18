import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { OperationeleWerkbak } from '@/lib/offMarket/acquisitie/operationeleWerkbak';
import ProductiekernWerkbakChips, { PRODUCTIEKERN_WERKBAK_VOLGORDE } from './ProductiekernWerkbakChips';

const counts: Record<OperationeleWerkbak, number> = {
  nieuwe_selectie: 4,
  eigenaar_achterhalen: 3,
  brief_opstellen: 2,
  printklaar: 1,
  geprint_posten: 5,
  opvolgen: 6,
  wachten: 7,
  afgehandeld: 8,
};

describe('ProductiekernWerkbakChips', () => {
  it('toont de acht dossierwerkbakken plus de formele Printbatches-dwarsdoorsnede en Alles', () => {
    render(
      <ProductiekernWerkbakChips
        actief="nieuwe_selectie"
        counts={counts}
        printbatchAantal={2}
        totaal={36}
        onChange={() => undefined}
      />,
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(10);
    expect(PRODUCTIEKERN_WERKBAK_VOLGORDE).toEqual([
      'nieuwe_selectie',
      'eigenaar_achterhalen',
      'brief_opstellen',
      'printklaar',
      'geprint_posten',
      'opvolgen',
      'wachten',
      'afgehandeld',
    ]);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Nieuwe selectie4',
      'Eigenaar achterhalen3',
      'Brief opstellen2',
      'Printklaar1',
      'Printbatches2',
      'Geprint / posten5',
      'Opvolgen6',
      'Wachten7',
      'Afgehandeld8',
      'Alles36',
    ]);
  });

  it('geeft Printbatches als eigen read-only view terug', () => {
    const onChange = vi.fn();
    render(
      <ProductiekernWerkbakChips
        actief="alles"
        counts={counts}
        printbatchAantal={2}
        totaal={36}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('productiekern-werkbak-printbatches'));
    expect(onChange).toHaveBeenCalledWith('printbatches');
  });
});
