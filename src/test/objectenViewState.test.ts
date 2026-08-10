import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_OBJECTEN_VIEW_STATE,
  loadObjectenViewState,
  saveObjectenViewState,
} from '@/lib/objectenViewState';

describe('objectenViewState', () => {
  beforeEach(() => sessionStorage.clear());

  it('gebruikt veilige standaardwaarden zonder opgeslagen context', () => {
    expect(loadObjectenViewState()).toEqual(DEFAULT_OBJECTEN_VIEW_STATE);
  });

  it('herstelt zoekterm, filters en archiefweergave', () => {
    saveObjectenViewState({
      zoek: 'Zeilstraat',
      typeFilter: 'type-1',
      subtypeFilter: 'sub-1',
      dealtypeFilter: 'deal-1',
      statusFilter: 'beschikbaar',
      archiefView: 'alles',
    });

    expect(loadObjectenViewState()).toEqual({
      zoek: 'Zeilstraat',
      typeFilter: 'type-1',
      subtypeFilter: 'sub-1',
      dealtypeFilter: 'deal-1',
      statusFilter: 'beschikbaar',
      archiefView: 'alles',
    });
  });

  it('verwerpt onbekende enumwaarden', () => {
    sessionStorage.setItem('crm:objecten:view-state:v1', JSON.stringify({
      zoek: 'x',
      statusFilter: 'onbekend',
      archiefView: 'verdwenen',
    }));

    expect(loadObjectenViewState()).toMatchObject({
      zoek: 'x',
      statusFilter: '',
      archiefView: 'actief',
    });
  });
});
