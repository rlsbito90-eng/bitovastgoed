import { describe, expect, it } from 'vitest';

import type { LegacyOffMarketBriefRij } from './legacyBriefCompatibiliteit';
import { bepaalLegacyOpvolgingGeschiktheid } from './legacyOpvolgingGeschiktheid';

const basis: LegacyOffMarketBriefRij = {
  id: 'brief-1',
  signaal_id: 'signaal-1',
  eigenaar_naam: 'Testpersoon',
  eigenaar_bedrijfsnaam: null,
  verzendadres: 'Voorbeeldstraat 1, 1234 AB Teststad',
  objectadres: 'Objectstraat 2, Teststad',
  aanhef: 'Geachte heer/mevrouw',
  onderwerp: 'Interesse in uw vastgoed',
  brieftekst: 'Voorbeeldbrieftekst',
  status: 'concept',
  verzonden_op: null,
  created_at: '2026-06-01T10:00:00Z',
  objectomschrijving: 'Voorbeeldobject',
  archived_at: null,
  archived_reason: null,
  geadresseerde_key: '|testpersoon|voorbeeldstraat 1 1234 ab teststad',
  printdatum: null,
  postdatum: null,
  verzendstatus: 'concept',
};

describe('bepaalLegacyOpvolgingGeschiktheid', () => {
  it('laat opvolging alleen toe bij een expliciete postdatum', () => {
    const resultaat = bepaalLegacyOpvolgingGeschiktheid({
      ...basis,
      status: 'verstuurd',
      printdatum: '2026-06-02T09:00:00Z',
      postdatum: '2026-06-03T16:00:00Z',
      verzonden_op: '2026-06-03T16:00:00Z',
      verzendstatus: 'gepost',
    });

    expect(resultaat).toMatchObject({
      geschikt: true,
      reden: 'expliciet_gepost',
      verzendbewijsOp: '2026-06-03T16:00:00Z',
    });
  });

  it('weigert status verstuurd zonder afzonderlijke postdatum', () => {
    const resultaat = bepaalLegacyOpvolgingGeschiktheid({
      ...basis,
      status: 'verstuurd',
      verzonden_op: '2026-06-02T09:00:00Z',
      verzendstatus: 'verstuurd',
    });

    expect(resultaat.geschikt).toBe(false);
    expect(resultaat.reden).toBe('verzending_onzeker');
    expect(resultaat.waarschuwingen[0]).toMatch(/niet hard bewezen/);
  });

  it('stelt printen nooit gelijk aan posten', () => {
    const resultaat = bepaalLegacyOpvolgingGeschiktheid({
      ...basis,
      printdatum: '2026-06-02T09:00:00Z',
    });

    expect(resultaat).toMatchObject({
      geschikt: false,
      reden: 'niet_gepost',
      verzendbewijsOp: null,
    });
  });

  it('laat gearchiveerde brieven nooit opnieuw in opvolging komen', () => {
    const resultaat = bepaalLegacyOpvolgingGeschiktheid({
      ...basis,
      archived_at: '2026-07-01T12:00:00Z',
      postdatum: '2026-06-03T16:00:00Z',
    });

    expect(resultaat.geschikt).toBe(false);
    expect(resultaat.reden).toBe('gearchiveerd');
  });
});
