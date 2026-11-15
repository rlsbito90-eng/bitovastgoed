// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ObjectVastgoed, Relatie } from '@/data/mock-data';
import ObjectvoorstellenPanel from './ObjectvoorstellenPanel';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    getPipelineVoorRelatie: () => [],
    addPipelineKandidaat: vi.fn(),
  }),
}));

const relatie = {
  id: 'r1', bedrijfsnaam: 'Fictieve belegger', contactpersoon: '', type: 'belegger',
  telefoon: '', email: '', regio: ['Noord-Holland'], assetClasses: ['wonen'],
  propertyTypeIds: [], budgetMin: undefined, budgetMax: 1_000_000,
  leadStatus: 'actief', ndaGetekend: false, laatsteContact: '',
} as Relatie;
const objecten = Array.from({ length: 11 }, (_, i) => ({
  id: 'object-' + (i + 1), titel: 'Fictief object ' + String(i + 1).padStart(2, '0'), plaats: 'Amsterdam',
  provincie: 'Noord-Holland', type: 'wonen', vraagprijs: 475_000,
  status: 'beschikbaar', anoniem: false, exclusief: false,
} as ObjectVastgoed));

describe('Objectvoorstellen — ook kansrijke suggesties na de eerste acht bereikbaar', () => {
  it('toont meer kansrijke objecten op verzoek en laat deze weer inklappen', () => {
    render(
      <MemoryRouter>
        <ObjectvoorstellenPanel relatie={relatie} objecten={objecten}
          zoekprofielen={[]} criteria={[]} besluiten={[]} loading={false} fout={null}
          onBesluit={vi.fn()} onWis={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Fictief object 08')).toBeTruthy();
    expect(screen.queryByText('Fictief object 09')).toBeNull();
    const meer = screen.getByTestId('kansrijk-toon-meer');
    expect(meer.textContent).toContain('3 resterend');
    fireEvent.click(meer);
    expect(screen.getByText('Fictief object 09')).toBeTruthy();
    expect(screen.getByText('Fictief object 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Toon eerste acht' }));
    expect(screen.queryByText('Fictief object 09')).toBeNull();
    expect(screen.getByTestId('kansrijk-toon-meer')).toBeTruthy();
  });

  it('laat een voorheen verborgen voorstel alsnog met reden afwijzen', async () => {
    const onBesluit = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ObjectvoorstellenPanel relatie={relatie} objecten={objecten}
          zoekprofielen={[]} criteria={[]} besluiten={[]} loading={false} fout={null}
          onBesluit={onBesluit} onWis={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('kansrijk-toon-meer'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Niet passend' })[8]);
    fireEvent.change(screen.getByLabelText('Reden'), { target: { value: 'locatie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bewaren' }));
    await waitFor(() =>
      expect(onBesluit).toHaveBeenCalledWith('object-9', 'afgewezen', 'locatie'),
    );
  });
});
