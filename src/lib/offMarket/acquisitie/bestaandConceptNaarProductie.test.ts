import { describe, expect, it, vi } from 'vitest';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { BriefContract, BriefversieContract } from './productiekernContract';
import {
  bouwProductiekernSnapshotsUitLegacyBrief,
  maakBestaandConceptDefinitief,
  parseProductiekernVerzendadres,
} from './bestaandConceptNaarProductie';

const legacyBrief: OffMarketBrief = {
  id: 'brief-1',
  signaal_id: 'signaal-1',
  eigenaar_naam: 'E.S. Blok',
  eigenaar_bedrijfsnaam: null,
  verzendadres: 'Voorbeeldstraat 12 H\n1012 AB Amsterdam',
  objectadres: 'Objectstraat 1, 1011 AA Amsterdam',
  objectomschrijving: 'Objectstraat 1 te Amsterdam',
  aanhef: 'Geachte heer/mevrouw,',
  onderwerp: 'Interesse in uw pand',
  brieftekst: 'Geachte heer/mevrouw,\n\nDit is de brieftekst.',
  status: 'concept',
  verzonden_op: null,
  aangemaakt_door: 'actor-1',
  created_at: '2026-08-16T18:00:00.000Z',
  updated_at: '2026-08-16T18:00:00.000Z',
  archived_at: null,
  archived_reason: null,
  kanaal: 'post',
};

const formeleBrief: BriefContract = {
  id: 'brief-1',
  briefnummer: null,
  signaalId: 'signaal-1',
  selectieId: 'selectie-1',
  objectId: null,
  relatieId: null,
  actieveVersie: 1,
  status: 'concept',
  vervangingVanBriefId: null,
  definitiefOp: null,
  vergrendeldOp: null,
  annuleringsreden: null,
};

const versie: BriefversieContract = {
  id: 'versie-1',
  briefId: 'brief-1',
  versienummer: 1,
  status: 'actief',
  inhoud: {
    onderwerp: 'Interesse in uw pand',
    brieftekst: legacyBrief.brieftekst,
    objectadres: legacyBrief.objectadres,
    objectomschrijving: legacyBrief.objectomschrijving,
    templateId: null,
    templateVersie: null,
  },
  geadresseerde: {
    naam: 'E.S. Blok',
    bedrijfsnaam: null,
    aanhef: 'Geachte heer/mevrouw,',
    straatHuisnummer: 'Voorbeeldstraat 12 H',
    postcode: '1012 AB',
    plaats: 'Amsterdam',
    land: 'Nederland',
    bron: 'legacy_concept',
    verificatiestatus: 'onbekend',
    relatieId: null,
  },
  bestandReferentie: null,
  createdAt: '2026-08-16T19:00:00.000Z',
  vervallenOp: null,
  verzondenOp: null,
};

function transacties() {
  return {
    maakBriefDefinitief: vi.fn(async () => ({ briefId: 'brief-1', briefnummer: 'BR2026000001' })),
    registreerBatchdocumenten: vi.fn(),
    vernieuwBatchdocumenten: vi.fn(),
    markeerBatchGeprint: vi.fn(),
    markeerBriefGepost: vi.fn(),
  };
}

function vroeg(maakBriefversie = vi.fn()) {
  return {
    startVerwerking: vi.fn(),
    reserveerBrief: vi.fn(),
    maakBriefversie,
    maakPrintbatch: vi.fn(),
    voegBriefversieToeAanBatch: vi.fn(),
  };
}

describe('legacy concept -> Productiekern', () => {
  it('parseert alleen een expliciet volledig NL-verzendadres', () => {
    expect(parseProductiekernVerzendadres('Straat 12\n1012ab Amsterdam')).toEqual({
      straatHuisnummer: 'Straat 12', postcode: '1012 AB', plaats: 'Amsterdam', land: 'Nederland',
    });
    expect(() => parseProductiekernVerzendadres('Straat 12')).toThrow('Volledig verzendadres');
    expect(() => parseProductiekernVerzendadres('Straat zonder nummer\n1012 AB Amsterdam')).toThrow('straat en huisnummer');
  });

  it('bouwt immutable inhoud- en geadresseerdesnapshots', () => {
    const snapshots = bouwProductiekernSnapshotsUitLegacyBrief(legacyBrief);
    expect(snapshots.inhoud.brieftekst).toBe(legacyBrief.brieftekst);
    expect(snapshots.geadresseerde).toMatchObject({
      naam: 'E.S. Blok',
      straatHuisnummer: 'Voorbeeldstraat 12 H',
      postcode: '1012 AB',
      plaats: 'Amsterdam',
      bron: 'legacy_concept',
    });
  });

  it('weigert e-mail en niet-conceptstatus vóór iedere Productiekern-write', () => {
    expect(() => bouwProductiekernSnapshotsUitLegacyBrief({ ...legacyBrief, kanaal: 'email' })).toThrow('Alleen fysieke postbrieven');
    expect(() => bouwProductiekernSnapshotsUitLegacyBrief({ ...legacyBrief, status: 'verstuurd' })).toThrow('Alleen een conceptbrief');
  });

  it('koppelt een nog niet formeel concept, leest canoniek terug en reserveert daarna exact één BR', async () => {
    const bridge = {
      koppelBestaandConcept: vi.fn(async () => ({
        briefId: 'brief-1', signaalId: 'signaal-1', briefVersieId: 'versie-1', versienummer: 1,
      })),
    };
    const lezen = {
      haalBrief: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(formeleBrief),
      haalBriefversies: vi.fn(async () => [versie]),
    };
    const tx = transacties();
    const vroege = vroeg();

    const resultaat = await maakBestaandConceptDefinitief({
      selectieId: 'selectie-1',
      signaalId: 'signaal-1',
      brief: legacyBrief,
      actorId: 'actor-1',
      uitgevoerdOp: '2026-08-16T19:30:00.000Z',
    }, { bridge, vroeg: vroege, lezen, transacties: tx });

    expect(bridge.koppelBestaandConcept).toHaveBeenCalledWith(expect.objectContaining({
      selectieId: 'selectie-1',
      briefId: 'brief-1',
      operationKey: 'legacy-bridge:brief-1',
    }));
    expect(vroege.maakBriefversie).not.toHaveBeenCalled();
    expect(tx.maakBriefDefinitief).toHaveBeenCalledWith(expect.objectContaining({
      actie: 'brief_definitief_maken',
      operationKey: 'brief-definitief:brief-1:v1',
      verwachtVersienummer: 1,
      jaar: 2026,
    }));
    expect(resultaat).toEqual({
      briefId: 'brief-1', briefnummer: 'BR2026000001', briefVersieId: 'versie-1', versienummer: 1,
    });
  });

  it('hergebruikt de actieve immutable versie als het formele concept inhoudelijk ongewijzigd is', async () => {
    const bridge = { koppelBestaandConcept: vi.fn() };
    const lezen = {
      haalBrief: vi.fn(async () => formeleBrief),
      haalBriefversies: vi.fn(async () => [versie]),
    };
    const tx = transacties();
    const vroege = vroeg();

    await maakBestaandConceptDefinitief({
      selectieId: 'selectie-1', signaalId: 'signaal-1', brief: legacyBrief, actorId: 'actor-1',
      uitgevoerdOp: '2026-08-16T19:30:00.000Z',
    }, { bridge, vroeg: vroege, lezen, transacties: tx });

    expect(bridge.koppelBestaandConcept).not.toHaveBeenCalled();
    expect(vroege.maakBriefversie).not.toHaveBeenCalled();
    expect(tx.maakBriefDefinitief).toHaveBeenCalledWith(expect.objectContaining({
      verwachtVersienummer: 1,
      operationKey: 'brief-definitief:brief-1:v1',
    }));
  });

  it('maakt eerst atomair een volgende versie als het opgeslagen concept sinds de vorige snapshot gewijzigd is', async () => {
    const gewijzigd = { ...legacyBrief, onderwerp: 'Aangepast onderwerp' };
    const versie2: BriefversieContract = {
      ...versie,
      id: 'versie-2',
      versienummer: 2,
      inhoud: { ...versie.inhoud, onderwerp: 'Aangepast onderwerp' },
    };
    const maakVersie = vi.fn(async () => versie2);
    const bridge = { koppelBestaandConcept: vi.fn() };
    const lezen = {
      haalBrief: vi.fn(async () => formeleBrief),
      haalBriefversies: vi.fn(async () => [versie]),
    };
    const tx = transacties();
    const vroege = vroeg(maakVersie);

    const resultaat = await maakBestaandConceptDefinitief({
      selectieId: 'selectie-1', signaalId: 'signaal-1', brief: gewijzigd, actorId: 'actor-1',
      uitgevoerdOp: '2026-08-16T19:30:00.000Z',
    }, { bridge, vroeg: vroege, lezen, transacties: tx });

    expect(maakVersie).toHaveBeenCalledWith(expect.objectContaining({
      briefId: 'brief-1',
      operationKey: 'briefversie:brief-1:na-v1',
      inhoudSnapshot: expect.objectContaining({ onderwerp: 'Aangepast onderwerp' }),
    }));
    expect(tx.maakBriefDefinitief).toHaveBeenCalledWith(expect.objectContaining({
      verwachtVersienummer: 2,
      operationKey: 'brief-definitief:brief-1:v2',
    }));
    expect(resultaat.versienummer).toBe(2);
  });

  it('stopt vóór nummerreservering wanneer de teruggelezen selectie afwijkt', async () => {
    const bridge = { koppelBestaandConcept: vi.fn() };
    const lezen = {
      haalBrief: vi.fn(async () => ({ ...formeleBrief, selectieId: 'andere-selectie' })),
      haalBriefversies: vi.fn(async () => [versie]),
    };
    const tx = transacties();

    await expect(maakBestaandConceptDefinitief({
      selectieId: 'selectie-1', signaalId: 'signaal-1', brief: legacyBrief, actorId: 'actor-1',
    }, { bridge, vroeg: vroeg(), lezen, transacties: tx })).rejects.toThrow('andere acquisitieselectie');
    expect(tx.maakBriefDefinitief).not.toHaveBeenCalled();
  });

  it('weigert een formeel concept met meerdere actieve versies', async () => {
    const bridge = { koppelBestaandConcept: vi.fn() };
    const lezen = {
      haalBrief: vi.fn(async () => formeleBrief),
      haalBriefversies: vi.fn(async () => [versie, { ...versie, id: 'versie-x' }]),
    };
    const tx = transacties();

    await expect(maakBestaandConceptDefinitief({
      selectieId: 'selectie-1', signaalId: 'signaal-1', brief: legacyBrief, actorId: 'actor-1',
    }, { bridge, vroeg: vroeg(), lezen, transacties: tx })).rejects.toThrow('meer dan één actieve briefversie');
    expect(tx.maakBriefDefinitief).not.toHaveBeenCalled();
  });
});
