// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ObjectVastgoed, Relatie } from '@/data/mock-data';
import type { RelatieObjectBesluit } from '@/hooks/useRelatieMatchingData';
import ObjectvoorstellenPanel from './ObjectvoorstellenPanel';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    getPipelineVoorRelatie: () => [],
    addPipelineKandidaat: vi.fn(),
  }),
}));

const relatie = {
  id: 'relatie-1',
  bedrijfsnaam: 'Fictieve koper',
  type: 'belegger',
  commercialRoles: ['koper'],
  assetClasses: ['wonen'],
  regio: ['Noord-Holland'],
} as Relatie;

const object = (i: number, wijzigingen: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id: 'object-' + i, titel: 'Testpand ' + i,
  type: 'wonen', status: 'beschikbaar', plaats: 'Haarlem',
  provincie: 'Noord-Holland', vraagprijs: 400_000,
  anoniem: true, exclusief: false, ...wijzigingen,
} as ObjectVastgoed);

function renderPanel(objecten: ObjectVastgoed[], besluiten: RelatieObjectBesluit[] = [],
  onBesluit = vi.fn().mockResolvedValue(undefined),
  onWis = vi.fn().mockResolvedValue(undefined),
) {
  const props = {
    relatie, objecten, zoekprofielen: [],
    criteria: [], besluiten, loading: false, fout: null,
    onBesluit, onWis,
  };
  const view = render(
    <MemoryRouter><ObjectvoorstellenPanel {...props} /></MemoryRouter>,
  );
  return { ...view, props, onBesluit, onWis };
}

describe('Relaties — objectvoorstellen in productie', () => {
  it('houdt de eerste 8 kansrijke voorstellen compact, maar verbergt de rest niet permanent', () => {
    renderPanel(Array.from({ length: 10 }, (_, i) => object(i + 1)));
    expect(screen.getByRole('link', { name: 'Testpand 1' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Testpand 9' })).toBeNull();
    const button = screen.getByTestId('meer-kansrijke-voorstellen');
    expect(button.textContent).toContain('Toon volgende 2 kansrijke voorstellen');
    fireEvent.click(button);
    expect(screen.getByRole('link', { name: 'Testpand 9' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Testpand 10' })).toBeTruthy();
    expect(screen.queryByTestId('meer-kansrijke-voorstellen')).toBeNull();
  });

  it('voorkomt dat een portefeuille met één locatie-indicatie bovenaan als kansrijk staat', () => {
    renderPanel([object(1, { isPortefeuille: true }), object(2)]);
    expect(screen.getByRole('link', { name: 'Testpand 2' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Testpand 1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Nog inhoudelijk beoordelen \(1\)/ }));
    expect(screen.getByRole('link', { name: 'Testpand 1' })).toBeTruthy();
    expect(screen.getByText(/Portefeuille: samenstelling en locaties per adres controleren/)).toBeTruthy();
  });

  it('behoudt expliciete Niet passend-besluiten in de historie en laat herstel toe', async () => {
    const onBesluit = vi.fn().mockResolvedValue(undefined);
    const onWis = vi.fn().mockResolvedValue(undefined);
    const view = renderPanel([object(1)], [], onBesluit, onWis);
    fireEvent.click(screen.getByRole('button', { name: 'Niet passend' }));
    fireEvent.change(screen.getByLabelText('Reden'), { target: { value: 'locatie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bewaren' }));
    await waitFor(() => expect(onBesluit).toHaveBeenCalledWith('object-1', 'afgewezen', 'locatie'));

    const besluit: RelatieObjectBesluit = {
      id: 'besluit-1', relatieId: relatie.id, objectId: 'object-1',
      status: 'afgewezen', redenCode: 'locatie', toelichting: null,
    };
    view.rerender(
      <MemoryRouter><ObjectvoorstellenPanel {...view.props} besluiten={[besluit]} /></MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Testpand 1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Eerder afgewezen \(1\)/ }));
    expect(screen.getByRole('link', { name: 'Testpand 1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Herstellen' }));
    await waitFor(() => expect(onWis).toHaveBeenCalledWith('object-1'));
  });
});
