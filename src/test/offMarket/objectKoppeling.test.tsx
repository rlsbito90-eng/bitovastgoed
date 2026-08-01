import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const linkObjectMutate = vi.fn();
const promoteMutate = vi.fn();

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    relaties: [],
    contactpersonen: [],
    objecten: [{
      id: 'obj-1',
      titel: 'Bestaand object',
      adres: 'Kerkstraat 10',
      postcode: '5061AB',
      plaats: 'Oisterwijk',
    }],
    getObjectById: () => null,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOffMarketLinks', () => ({
  useLinkRelatieToSignaal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePromoteSignaalToObject: () => ({ mutateAsync: promoteMutate, isPending: false }),
}));

vi.mock('@/hooks/useLinkObjectToSignaal', () => ({
  useLinkObjectToSignaal: () => ({ mutateAsync: linkObjectMutate, isPending: false }),
}));

vi.mock('@/components/forms/EntityPicker', () => ({
  default: () => <div data-testid="entity-picker" />,
}));

vi.mock('@/components/forms/RelatieFormDialog', () => ({
  default: () => null,
}));

import SignaalKoppelingenSectie from '@/components/offmarket/SignaalKoppelingenSectie';

describe('SignaalKoppelingenSectie objectcontrole', () => {
  it('toont een bestaand CRM-object als match vóór nieuw object aanmaken', () => {
    render(
      <MemoryRouter>
        <SignaalKoppelingenSectie signaal={{
          id: 'sig-1',
          adres: 'Kerkstraat 10',
          postcode: '5061 AB',
          plaats: 'Oisterwijk',
          gekoppeld_object_id: null,
          eigenaar_relatie_id: null,
        } as any} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('signaal-objectmatches')).toBeInTheDocument();
    expect(screen.getByText('Bestaand object')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Koppel object/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toch nieuw object/i })).toBeInTheDocument();
  });

  it('toont direct nieuw object aanmaken wanneer er geen match is', () => {
    render(
      <MemoryRouter>
        <SignaalKoppelingenSectie signaal={{
          id: 'sig-2',
          adres: 'Andereweg 99',
          postcode: '9999ZZ',
          plaats: 'Elders',
          gekoppeld_object_id: null,
          eigenaar_relatie_id: null,
        } as any} />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('signaal-objectmatches')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nieuw object aanmaken/i })).toBeInTheDocument();
  });
});
