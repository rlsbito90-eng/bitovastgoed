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
      profielFilter: 'profiel:family_office',
    });

    expect(loadRelatiesViewState()).toEqual({
      zoek: 'Rubens',
      statusFilter: 'warm',
      profielFilter: 'profiel:family_office',
    });
  });

  it('verwerpt onbekende filterwaarden', () => {
    sessionStorage.setItem('crm:relaties:view-state:v2', JSON.stringify({
      zoek: 'test',
      statusFilter: 'onbekend',
      profielFilter: 'profiel:anders',
    }));
    expect(loadRelatiesViewState()).toEqual({
      zoek: 'test', statusFilter: '', profielFilter: '',
    });
  });
  it('herstelt een bestaande v1 hoofdtypefilter zonder als bewezen profiel te classificeren',()=>{
    sessionStorage.setItem('crm:relaties:view-state:v1',JSON.stringify({
      zoek:'',statusFilter:'warm',typeFilter:'belegger',
    }));
    expect(loadRelatiesViewState()).toEqual({
      zoek:'',statusFilter:'warm',profielFilter:'legacy:belegger',
    });
  });
  it('geeft een huidige v2 profielkeuze voorrang op een achtergebleven v1 filter',()=>{
    sessionStorage.setItem('crm:relaties:view-state:v1',JSON.stringify({typeFilter:'ontwikkelaar'}));
    saveRelatiesViewState({zoek:'',statusFilter:'',profielFilter:'profiel:ontwikkelende_belegger'});
    expect(loadRelatiesViewState().profielFilter).toBe('profiel:ontwikkelende_belegger');
  });
});
