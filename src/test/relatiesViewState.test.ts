import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_RELATIES_VIEW_STATE,
  loadRelatiesViewState,
  saveRelatiesViewState,
} from '@/lib/relatiesViewState';

describe('relatiesViewState', () => {
  beforeEach(() => sessionStorage.clear());

  it('gebruikt veilige standaardwaarden zonder opgeslagen context', () => {
    expect(loadRelatiesViewState()).toEqual(DEFAULT_RELATIES_VIEW_STATE);
  });

  it('herstelt zoekterm en filters binnen dezelfde sessie', () => {
    saveRelatiesViewState({
      zoek: 'Rubens',
      statusFilter: 'warm',
      typeFilter: 'belegger',
    });

    expect(loadRelatiesViewState()).toEqual({
      zoek: 'Rubens',
      statusFilter: 'warm',
      typeFilter: 'belegger',
    });
  });

  it('verwerpt onbekende filterwaarden', () => {
    sessionStorage.setItem('crm:relaties:view-state:v1', JSON.stringify({
      zoek: 'test',
      statusFilter: 'onbekend',
      typeFilter: 'anders',
    }));

    expect(loadRelatiesViewState()).toEqual({
      zoek: 'test',
      statusFilter: '',
      typeFilter: '',
    });
  });
});
