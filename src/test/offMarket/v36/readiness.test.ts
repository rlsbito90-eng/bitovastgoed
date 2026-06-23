// V36 — Pure tests voor de afgeleide readiness-helper (Acquisitieselectie 1B).
// Geen netwerk, geen Kadaster/BAG/PDF-aanroepen. Geen echte namen/adressen.
import { describe, it, expect } from 'vitest';
import {
  bepaalSignaalReadiness, aggregeerKpis, pastInFilter,
  isVolledigPostadres, geadresseerdenVoorSignaal,
} from '@/lib/offMarket/acquisitie/readiness';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function mkSignaal(over: Partial<any> = {}): OffMarketSignaal {
  return {
    id: 'sig-1',
    titel: 'Testsignaal',
    type_signaal: 'overig',
    status: 'eigenaar_gevonden',
    plaats: 'Voorbeeldstad',
    adres: 'Voorbeeldlaan 1',
    ai_status: 'klaar',
    ai_score: 75,
    ...over,
  } as any;
}

function mkBrief(over: Partial<OffMarketBrief>): OffMarketBrief {
  return {
    id: 'b-' + Math.random().toString(36).slice(2, 8),
    signaal_id: 'sig-1',
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: null,
    verzendadres: null,
    objectadres: null,
    objectomschrijving: null,
    aanhef: null,
    onderwerp: null,
    brieftekst: '',
    status: 'concept',
    verzonden_op: null,
    aangemaakt_door: null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    archived_at: null,
    archived_reason: null,
    kanaal: 'post',
    campagne_stap: null,
    geadresseerde_key: null,
    verzendstatus: 'concept',
    ...over,
  } as OffMarketBrief;
}

const VOLLEDIG_ADRES = 'Eigenaarstraat 12\n1234 AB Voorbeeldstad';

describe('readiness — geadresseerden dedupe', () => {
  it('meerdere concepten voor één eigenaar tellen als één geadresseerde', () => {
    const sig = mkSignaal();
    const brieven = [
      mkBrief({ id: 'b1', eigenaar_naam: 'A. Test', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|a' }),
      mkBrief({ id: 'b2', eigenaar_naam: 'A. Test', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|a' }),
      mkBrief({ id: 'b3', eigenaar_naam: 'A. Test', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|a' }),
    ];
    const g = geadresseerdenVoorSignaal(sig, brieven);
    expect(g).toHaveLength(1);
    expect(g[0].heeftActiefConcept).toBe(true);
  });

  it('twee eigenaren tellen als twee geadresseerden', () => {
    const sig = mkSignaal();
    const brieven = [
      mkBrief({ id: 'b1', eigenaar_naam: 'Eén', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|1' }),
      mkBrief({ id: 'b2', eigenaar_naam: 'Twee', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|2' }),
    ];
    const g = geadresseerdenVoorSignaal(sig, brieven);
    expect(g).toHaveLength(2);
  });

  it('valt terug op signaal-eigenaar wanneer er geen brieven zijn', () => {
    const sig = mkSignaal({
      eigenaar_naam: 'Z. Voorbeeld',
      eigenaar_verzendadres: VOLLEDIG_ADRES,
    });
    const g = geadresseerdenVoorSignaal(sig, []);
    expect(g).toHaveLength(1);
    expect(g[0].volledigPostadres).toBe(true);
  });
});

describe('readiness — adresvalidatie', () => {
  it('eist postcode en straatnummer', () => {
    expect(isVolledigPostadres('Straat 1\n1234 AB Plaats')).toBe(true);
    expect(isVolledigPostadres('Plaats zonder postcode')).toBe(false);
    expect(isVolledigPostadres('1234 AB zonder straat')).toBe(false);
    expect(isVolledigPostadres(null)).toBe(false);
  });
});

describe('readiness — fase-beslisboom', () => {
  it('geen eigenaar → eigenaar_ontbreekt (status gevonden)', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal({ status: 'eigenaar_gevonden' }),
      brieven: [],
    });
    expect(r.fase).toBe('eigenaar_ontbreekt');
    expect(r.info.status).toBe('geblokkeerd');
  });

  it('geen eigenaar + status te_onderzoeken → onderzoek_nodig', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal({ status: 'te_onderzoeken' }),
      brieven: [],
    });
    expect(r.fase).toBe('onderzoek_nodig');
  });

  it('eigenaar zonder volledig adres → adres_ontbreekt', () => {
    const sig = mkSignaal({ eigenaar_naam: 'X', eigenaar_verzendadres: 'Onvolledig' });
    const r = bepaalSignaalReadiness({ signaal: sig, brieven: [] });
    expect(r.fase).toBe('adres_ontbreekt');
    expect(r.info.status).toBe('geblokkeerd');
  });

  it('eigenaar + volledig adres + geen concept → brief_voorbereiden', () => {
    const sig = mkSignaal({ eigenaar_naam: 'X', eigenaar_verzendadres: VOLLEDIG_ADRES });
    const r = bepaalSignaalReadiness({ signaal: sig, brieven: [] });
    expect(r.fase).toBe('brief_voorbereiden');
  });

  it('actief concept + volledig adres → gereed_voor_print', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES,
        geadresseerde_key: 'k|x', status: 'concept', verzendstatus: 'concept',
      })],
    });
    expect(r.fase).toBe('gereed_voor_print');
  });

  it('verzendstatus geprint → fase geprint', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES,
        geadresseerde_key: 'k|x', status: 'concept', verzendstatus: 'geprint',
      })],
    });
    expect(r.fase).toBe('geprint');
  });

  it('verstuurd → fase gepost', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES,
        geadresseerde_key: 'k|x', status: 'verstuurd', verzendstatus: 'gepost',
        verzonden_op: '2026-01-02T12:00:00Z',
      })],
    });
    expect(r.fase).toBe('gepost');
  });

  it('opvolgdatum in het verleden zonder respons → opvolging_open', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({
        eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES,
        geadresseerde_key: 'k|x', status: 'verstuurd', verzendstatus: 'gepost',
        opvolgdatum: '2020-01-01',
      } as any)],
    });
    expect(r.fase).toBe('opvolging_open');
  });

  it('archief-status → afgerond', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal({ status: 'archief' }),
      brieven: [],
    });
    expect(r.fase).toBe('afgerond');
  });
});

describe('readiness — waarschuwingen blokkeren niet', () => {
  it('BAG meerdere_matches is waarschuwing, geen blokkade', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal({ bag_status: 'meerdere_matches' }),
      brieven: [mkBrief({
        eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES,
        geadresseerde_key: 'k|x',
      })],
    });
    expect(r.fase).toBe('gereed_voor_print');
    expect(r.waarschuwingen).toContain('bag_meerdere_matches');
    expect(r.info.status).not.toBe('geblokkeerd');
  });

  it('lage AI-score is waarschuwing', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal({ ai_score: 10 }),
      brieven: [mkBrief({
        eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES,
        geadresseerde_key: 'k|x',
      })],
    });
    expect(r.waarschuwingen).toContain('ai_lage_score');
  });
});

describe('readiness — aggregatie', () => {
  it('KPI-totalen volgen dezelfde fase-uitkomst', () => {
    const r1 = bepaalSignaalReadiness({
      signaal: mkSignaal({ id: 's1' }),
      brieven: [mkBrief({ signaal_id: 's1', eigenaar_naam: 'A', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|a' })],
    });
    const r2 = bepaalSignaalReadiness({
      signaal: mkSignaal({ id: 's2', status: 'te_onderzoeken' }),
      brieven: [],
    });
    const kpis = aggregeerKpis([r1, r2]);
    expect(kpis.signalen).toBe(2);
    expect(kpis.printklaar).toBe(1);
    expect(kpis.geblokkeerd).toBe(1);
    expect(kpis.geadresseerden).toBe(1);
  });

  it('drie concepten voor één eigenaar → KPI geadresseerden = 1', () => {
    const r = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [
        mkBrief({ id: 'a', eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|x' }),
        mkBrief({ id: 'b', eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|x' }),
        mkBrief({ id: 'c', eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|x' }),
      ],
    });
    const kpis = aggregeerKpis([r]);
    expect(kpis.geadresseerden).toBe(1);
  });
});

describe('readiness — filter', () => {
  it('printklaar-filter laat alleen gereed_voor_print door', () => {
    const klaar = bepaalSignaalReadiness({
      signaal: mkSignaal(),
      brieven: [mkBrief({ eigenaar_naam: 'X', verzendadres: VOLLEDIG_ADRES, geadresseerde_key: 'k|x' })],
    });
    const blok = bepaalSignaalReadiness({ signaal: mkSignaal({ status: 'eigenaar_gevonden' }), brieven: [] });
    expect(pastInFilter(klaar, 'printklaar')).toBe(true);
    expect(pastInFilter(blok, 'printklaar')).toBe(false);
    expect(pastInFilter(blok, 'geblokkeerd')).toBe(true);
  });
});
