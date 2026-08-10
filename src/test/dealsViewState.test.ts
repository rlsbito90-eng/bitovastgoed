import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DEALS_VIEW_STATE,
  loadDealsViewState,
  saveDealsViewState,
} from '@/lib/dealsViewState';

describe('dealsViewState', () => {
  beforeEach(() => sessionStorage.clear());

  it('gebruikt veilige standaardwaarden zonder opgeslagen context', () => {
    expect(loadDealsViewState()).toEqual(DEFAULT_DEALS_VIEW_STATE);
  });

  it('herstelt zoekterm, fase en archiefweergave', () => {
    saveDealsViewState({
      zoek: 'Piet Heinstraat',
      faseFilter: 'onderhandeling',
      archiefView: 'alles',
    });

    expect(loadDealsViewState()).toEqual({
      zoek: 'Piet Heinstraat',
      faseFilter: 'onderhandeling',
      archiefView: 'alles',
    });
  });

  it('verwerpt onbekende enumwaarden', () => {
    sessionStorage.setItem('crm:deals:view-state:v1', JSON.stringify({
      zoek: 'x',
      faseFilter: 'onbekend',
      archiefView: 'verdwenen',
    }));

    expect(loadDealsViewState()).toEqual({
      zoek: 'x',
      faseFilter: '',
      archiefView: 'actief',
    });
  });
});
