import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TAKEN_VIEW_STATE,
  loadTakenViewState,
  saveTakenViewState,
} from '@/lib/takenViewState';

describe('takenViewState', () => {
  beforeEach(() => sessionStorage.clear());

  it('valt terug op een veilige standaard zonder opgeslagen context', () => {
    expect(loadTakenViewState()).toEqual(DEFAULT_TAKEN_VIEW_STATE);
  });

  it('herstelt tab, zoekterm en filters binnen dezelfde sessie', () => {
    saveTakenViewState({
      zoek: 'Zeilstraat',
      prioriteitFilter: 'hoog',
      typeFilter: 'Follow-up',
      statusFilter: 'wacht_op_reactie',
      tab: 'wachten',
    });

    expect(loadTakenViewState()).toEqual({
      zoek: 'Zeilstraat',
      prioriteitFilter: 'hoog',
      typeFilter: 'Follow-up',
      statusFilter: 'wacht_op_reactie',
      tab: 'wachten',
    });
  });

  it('accepteert geen onbekende enumwaarden uit sessionStorage', () => {
    sessionStorage.setItem('crm:taken:view-state:v3', JSON.stringify({
      zoek: 'x',
      prioriteitFilter: 'extreem',
      statusFilter: 'verdwenen',
      tab: 'onbekend',
    }));

    expect(loadTakenViewState()).toMatchObject({
      zoek: 'x',
      prioriteitFilter: '',
      statusFilter: '',
      tab: 'vandaag',
    });
  });
});
