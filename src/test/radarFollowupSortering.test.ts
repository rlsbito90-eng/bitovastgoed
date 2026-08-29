import { describe, expect, it } from 'vitest';

import {
  sorteerRijen,
  standaardSortering,
  type SorteerbareRij,
} from '@/lib/offMarket/acquisitie/sortering';

function rij(id: string, datum: string | null): SorteerbareRij {
  return {
    signaalId: id,
    toegevoegdOp: '2026-08-01T10:00:00Z',
    procesDatumIsoWachten: null,
    prioriteit: null,
    aiScore: null,
    plaats: null,
    ctx: {
      werkbak: 'actie',
      actieCategorie: 'opvolging_verlopen',
      actieSubfilter: 'opvolgen',
      procesDatum: datum ? { iso: datum, label: datum, a11yLabel: datum } : null,
    },
  };
}

describe('opvolgdatum-sortering', () => {
  it('gebruikt bij Actie > Opvolgen standaard de oudste opvolgdatum eerst', () => {
    expect(standaardSortering('actie', 'opvolgen', 'alles')).toBe('opvolgdatum_oudste');
  });

  it('kan zowel oudste als nieuwste opvolgdatum eerst tonen en zet lege datums achteraan', () => {
    const rijen = [rij('b', '2026-08-21'), rij('a', '2026-07-01'), rij('c', null)];

    expect(sorteerRijen('opvolgdatum_oudste', 'actie', rijen).map(r => r.signaalId)).toEqual(['a', 'b', 'c']);
    expect(sorteerRijen('opvolgdatum_nieuwste', 'actie', rijen).map(r => r.signaalId)).toEqual(['b', 'a', 'c']);
  });
});
