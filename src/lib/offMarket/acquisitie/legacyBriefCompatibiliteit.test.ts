import { describe, expect, it } from 'vitest';
import {
  mapLegacyBriefNaarProductiekern,
  type LegacyOffMarketBriefRij,
} from './legacyBriefCompatibiliteit';

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

const adres = {
  straatHuisnummer: 'Voorbeeldstraat 1',
  postcode: '1234 AB',
  plaats: 'Teststad',
  land: 'Nederland',
};

describe('legacy briefcompatibiliteit', () => {
  it('maakt een read-only conceptweergave zonder BR-nummer', () => {
    const resultaat = mapLegacyBriefNaarProductiekern(basis, adres);

    expect(resultaat.brief).toMatchObject({
      id: 'brief-1',
      briefnummer: null,
      signaalId: 'signaal-1',
      status: 'concept',
      actieveVersie: 1,
    });
    expect(resultaat.versie).toMatchObject({
      id: 'legacy:brief-1:v1',
      status: 'actief',
      verzondenOp: null,
    });
    expect(resultaat.legacy.geadresseerdeKey).toBe(basis.geadresseerde_key);
    expect(resultaat.waarschuwingen).toEqual([]);
  });

  it('houdt printdatum en postdatum afzonderlijk en gebruikt alleen postdatum als verzendbewijs', () => {
    const resultaat = mapLegacyBriefNaarProductiekern({
      ...basis,
      status: 'verstuurd',
      printdatum: '2026-06-02T09:00:00Z',
      postdatum: '2026-06-03T16:00:00Z',
      verzonden_op: '2026-06-03T16:00:00Z',
      verzendstatus: 'gepost',
    }, adres);

    expect(resultaat.brief.status).toBe('definitief');
    expect(resultaat.brief.definitiefOp).toBe('2026-06-03T16:00:00Z');
    expect(resultaat.versie.status).toBe('verzonden');
    expect(resultaat.versie.verzondenOp).toBe('2026-06-03T16:00:00Z');
    expect(resultaat.legacy.printdatum).toBe('2026-06-02T09:00:00Z');
    expect(resultaat.legacy.postdatum).toBe('2026-06-03T16:00:00Z');
  });

  it('behandelt verstuurd zonder postdatum als onzeker en niet als bewezen verzending', () => {
    const resultaat = mapLegacyBriefNaarProductiekern({
      ...basis,
      status: 'verstuurd',
      printdatum: '2026-06-02T09:00:00Z',
      verzonden_op: '2026-06-02T09:00:00Z',
      verzendstatus: 'verstuurd',
    }, adres);

    expect(resultaat.brief.status).toBe('concept');
    expect(resultaat.brief.definitiefOp).toBeNull();
    expect(resultaat.versie.status).toBe('actief');
    expect(resultaat.versie.verzondenOp).toBeNull();
    expect(resultaat.waarschuwingen).toContain(
      'Legacy record meldt verzending zonder afzonderlijke postdatum; posthandeling is niet hard bewezen.',
    );
  });

  it('archiveert zonder historische inhoud te verwijderen', () => {
    const resultaat = mapLegacyBriefNaarProductiekern({
      ...basis,
      archived_at: '2026-07-01T12:00:00Z',
      archived_reason: 'Dubbel record',
    }, adres);

    expect(resultaat.brief.status).toBe('geannuleerd');
    expect(resultaat.brief.annuleringsreden).toBe('Dubbel record');
    expect(resultaat.versie.inhoud.brieftekst).toBe('Voorbeeldbrieftekst');
  });
});
