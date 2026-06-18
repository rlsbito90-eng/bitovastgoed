// V2.2 — samenvatting telt e-mails verzonden apart van post.
import { describe, it, expect } from 'vitest';
import { groepeerBrievenPerGeadresseerde, samenvatting } from '@/lib/offMarket/brieven/groepering';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function brief(p: Partial<OffMarketBrief> = {}): OffMarketBrief {
  return {
    id: 'b-' + Math.random().toString(36).slice(2),
    signaal_id: 's1',
    eigenaar_naam: 'Eigenaar Alfa',
    eigenaar_bedrijfsnaam: null,
    verzendadres: null,
    objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: null,
    status: 'verstuurd', verzonden_op: '2026-06-01T00:00:00Z',
    aangemaakt_door: null,
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    kanaal: 'post', campagne_stap: 'brief_1',
    ...p,
  } as OffMarketBrief;
}

describe('BrievenSamenvatting — emails apart geteld', () => {
  it('telt brief_1-post en email_1-verzonden afzonderlijk', () => {
    const groepen = groepeerBrievenPerGeadresseerde([
      brief({ id: 'p1', kanaal: 'post', campagne_stap: 'brief_1' }),
      brief({ id: 'e1', kanaal: 'email', campagne_stap: 'email_1' }),
      brief({ id: 'e2', kanaal: 'email', campagne_stap: 'email_2', created_at: '2026-06-02T10:00:00Z' }),
    ]);
    const s = samenvatting(groepen, [], 's1');
    expect(s.brief1Verstuurd).toBe(1);
    expect(s.emailsVerstuurd).toBe(2);
  });
});
