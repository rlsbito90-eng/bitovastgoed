// V39 — Readiness moet post en e-mail intern apart classificeren.
// E-mail mag nooit "Gepost" of "geprintOfGepost" worden, en mag de
// adres-onvolledig-blokkade niet triggeren wanneer er geen postbrief is.
import { describe, it, expect } from 'vitest';
import {
  bepaalSignaalReadiness, aggregeerKpis,
} from '@/lib/offMarket/acquisitie/readiness';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function mkSignaal(over: Partial<any> = {}): OffMarketSignaal {
  return {
    id: 'sig-1', titel: 'Test', type_signaal: 'overig',
    status: 'eigenaar_gevonden', plaats: 'Stad', adres: 'Laan 1',
    ai_status: 'klaar', ai_score: 80, ...over,
  } as any;
}

function mkBrief(over: Partial<OffMarketBrief>): OffMarketBrief {
  return {
    id: 'b-' + Math.random().toString(36).slice(2, 8),
    signaal_id: 'sig-1',
    eigenaar_naam: null, eigenaar_bedrijfsnaam: null,
    verzendadres: null, objectadres: null, objectomschrijving: null,
    aanhef: null, onderwerp: null, brieftekst: '',
    status: 'concept', verzonden_op: null, aangemaakt_door: null,
    created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z',
    archived_at: null, archived_reason: null,
    kanaal: 'post', campagne_stap: null,
    geadresseerde_key: null, verzendstatus: 'concept',
    ...over,
  } as OffMarketBrief;
}

const VOLLEDIG = 'Eigenaarstraat 12\n1234 AB Stad';

describe('readiness — e-mail telt nooit als gepost', () => {
  it('één e-mail verstuurd zonder postbrief → fase email_verzonden, geprintOfGepost=0', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        id: 'e1', eigenaar_bedrijfsnaam: 'Demo BV',
        verzendadres: null,
        geadresseerde_key: 'k|demo',
        kanaal: 'email', campagne_stap: 'email_1',
        status: 'verstuurd', verzendstatus: 'verzonden',
      })],
    });
    expect(r.fase).toBe('email_verzonden');
    expect(r.telling.geprintOfGepost).toBe(0);
    expect(r.geadresseerden[0].heeftGepost).toBe(false);
    expect(r.geadresseerden[0].heeftEmailVerzonden).toBe(true);
  });

  it('e-mail zonder verzendadres mag niet als adres_ontbreekt blokkeren', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        id: 'e1', eigenaar_bedrijfsnaam: 'Demo BV',
        verzendadres: null,
        geadresseerde_key: 'k|demo',
        kanaal: 'email', status: 'verstuurd', verzendstatus: 'verzonden',
      })],
    });
    expect(r.fase).not.toBe('adres_ontbreekt');
    expect(r.info.status).not.toBe('geblokkeerd');
  });

  it('combinatie post-concept + e-mail verstuurd → post-pijler wint (gereed_voor_print)', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [
        mkBrief({
          id: 'p1', eigenaar_naam: 'X', verzendadres: VOLLEDIG,
          geadresseerde_key: 'k|x', kanaal: 'post', status: 'concept',
          verzendstatus: 'concept',
        }),
        mkBrief({
          id: 'e1', eigenaar_naam: 'X',
          geadresseerde_key: 'k|x', kanaal: 'email',
          status: 'verstuurd', verzendstatus: 'verzonden',
        }),
      ],
    });
    expect(r.fase).toBe('gereed_voor_print');
    expect(r.telling.geprintOfGepost).toBe(0);
  });

  it('postbrief verstuurd → blijft fase gepost (regressie)', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        eigenaar_naam: 'X', verzendadres: VOLLEDIG,
        geadresseerde_key: 'k|x', kanaal: 'post',
        status: 'verstuurd', verzendstatus: 'gepost',
      })],
    });
    expect(r.fase).toBe('gepost');
    expect(r.telling.geprintOfGepost).toBe(1);
  });

  it('KPI geprintOfGepost telt e-mail niet', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        eigenaar_bedrijfsnaam: 'Demo BV',
        geadresseerde_key: 'k|demo', kanaal: 'email',
        status: 'verstuurd', verzendstatus: 'verzonden',
      })],
    });
    const kpis = aggregeerKpis([r]);
    expect(kpis.printklaar).toBe(0);
    expect(kpis.geblokkeerd).toBe(0);
  });
});
