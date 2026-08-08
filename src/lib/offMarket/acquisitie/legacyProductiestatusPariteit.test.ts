import { describe, expect, it } from 'vitest';

import { bepaalLegacyProductiestatus } from './legacyProductiestatusPariteit';

const basis = {
  id: 'brief-1',
  signaal_id: 'signaal-1',
  eigenaar_naam: 'Voorbeeld',
  eigenaar_bedrijfsnaam: null,
  verzendadres: 'Markt 1, 1012 JS Amsterdam',
  objectadres: 'Markt 1',
  aanhef: null,
  onderwerp: null,
  brieftekst: null,
  status: 'concept',
  verzonden_op: null,
  created_at: '2026-08-01T09:00:00.000Z',
  objectomschrijving: null,
  archived_at: null,
  archived_reason: null,
  geadresseerde_key: 'geadresseerde-1',
  printdatum: null,
  postdatum: null,
  verzendstatus: null,
};

describe('bepaalLegacyProductiestatus', () => {
  it('houdt een lege brief als concept', () => {
    expect(bepaalLegacyProductiestatus(basis)).toMatchObject({
      status: 'concept',
      printBevestigd: false,
      postBevestigd: false,
    });
  });

  it('ziet bestaande brieftekst als printklaar maar niet als geprint', () => {
    expect(bepaalLegacyProductiestatus({ ...basis, brieftekst: 'Tekst' })).toMatchObject({
      status: 'printklaar',
      printBevestigd: false,
      postBevestigd: false,
    });
  });

  it('houdt printen strikt gescheiden van posten', () => {
    expect(bepaalLegacyProductiestatus({
      ...basis,
      brieftekst: 'Tekst',
      printdatum: '2026-08-02T10:00:00.000Z',
    })).toMatchObject({
      status: 'geprint',
      printBevestigd: true,
      postBevestigd: false,
      verzendbewijsOp: null,
    });
  });

  it('gebruikt postdatum als hard verzendbewijs', () => {
    expect(bepaalLegacyProductiestatus({
      ...basis,
      brieftekst: 'Tekst',
      printdatum: '2026-08-02T10:00:00.000Z',
      postdatum: '2026-08-03T09:00:00.000Z',
      status: 'verstuurd',
    })).toMatchObject({
      status: 'gepost',
      printBevestigd: true,
      postBevestigd: true,
      verzendbewijsOp: '2026-08-03T09:00:00.000Z',
    });
  });

  it('markeert verstuurd zonder postdatum als onzeker', () => {
    const resultaat = bepaalLegacyProductiestatus({
      ...basis,
      brieftekst: 'Tekst',
      printdatum: '2026-08-02T10:00:00.000Z',
      status: 'verstuurd',
      verzonden_op: '2026-08-03T09:00:00.000Z',
    });

    expect(resultaat).toMatchObject({
      status: 'verzonden_onzeker',
      printBevestigd: true,
      postBevestigd: false,
      verzendbewijsOp: '2026-08-03T09:00:00.000Z',
    });
    expect(resultaat.waarschuwingen).toContain(
      'Legacy record meldt verzending zonder afzonderlijke postdatum; posthandeling is niet hard bewezen.',
    );
  });

  it('behoudt archivering als terminale toestand', () => {
    expect(bepaalLegacyProductiestatus({
      ...basis,
      archived_at: '2026-08-05T09:00:00.000Z',
      printdatum: '2026-08-02T10:00:00.000Z',
    })).toMatchObject({
      status: 'gearchiveerd',
      printBevestigd: true,
      postBevestigd: false,
    });
  });
});
