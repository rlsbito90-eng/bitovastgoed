import { describe, expect, it } from 'vitest';

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import {
  actueleVerzondenBrievenPerGeadresseerde,
  isActueleOnverzondenPostbrief,
  volgendePostCampagneStap,
} from './postCampagneVoortgang';

function brief(args: {
  id: string;
  status?: 'concept' | 'definitief' | 'verstuurd';
  stap?: 'brief_1' | 'brief_2' | 'brief_3' | null;
  key?: string;
  verzondenOp?: string | null;
}): OffMarketBrief {
  return {
    id: args.id,
    signaal_id: 'signaal-1',
    eigenaar_naam: 'A. Voorbeeld',
    eigenaar_bedrijfsnaam: null,
    verzendadres: 'Straat 1\n1234 AB Plaats',
    objectadres: null,
    objectomschrijving: null,
    aanhef: null,
    onderwerp: null,
    brieftekst: 'Tekst',
    status: args.status ?? 'verstuurd',
    verzonden_op: args.verzondenOp ?? null,
    aangemaakt_door: null,
    created_at: args.verzondenOp ?? '2026-01-01T10:00:00Z',
    updated_at: args.verzondenOp ?? '2026-01-01T10:00:00Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'post',
    campagne_stap: args.stap ?? null,
    geadresseerde_key: args.key ?? 'persoon-1',
    verzendstatus: args.status === 'verstuurd' || args.status === undefined ? 'gepost' : 'concept',
  };
}

describe('postcampagnevoortgang', () => {
  it('leidt de volgende stap ook uit legacy verzendingen zonder stap af', () => {
    expect(volgendePostCampagneStap([
      brief({ id: 'oud-1', stap: null, verzondenOp: '2026-01-01T10:00:00Z' }),
      brief({ id: 'oud-2', stap: null, verzondenOp: '2026-02-01T10:00:00Z' }),
    ])).toBe('brief_3');
  });

  it('beschouwt Brief 2 als actuele productie na een verzonden Brief 1', () => {
    const brief1 = brief({ id: 'b1', stap: 'brief_1', verzondenOp: '2026-01-01T10:00:00Z' });
    const brief2 = brief({ id: 'b2', status: 'concept', stap: 'brief_2' });
    const dubbelBrief1 = brief({ id: 'dubbel', status: 'concept', stap: 'brief_1' });
    const scope = [brief1, brief2, dubbelBrief1];

    expect(isActueleOnverzondenPostbrief(brief2, scope)).toBe(true);
    expect(isActueleOnverzondenPostbrief(dubbelBrief1, scope)).toBe(false);
  });

  it('kiest per geadresseerde alleen de nieuwste echte verzending', () => {
    const actueel = actueleVerzondenBrievenPerGeadresseerde([
      brief({ id: 'b1', stap: 'brief_1', key: 'a', verzondenOp: '2026-01-01T10:00:00Z' }),
      brief({ id: 'b2', stap: 'brief_2', key: 'a', verzondenOp: '2026-02-01T10:00:00Z' }),
      brief({ id: 'ander', stap: 'brief_1', key: 'b', verzondenOp: '2026-01-15T10:00:00Z' }),
    ]);

    expect(actueel.map((item) => item.id).sort()).toEqual(['ander', 'b2']);
  });
});

