import { describe, expect, it } from 'vitest';
import {
  isGeldigeBatchovergang,
  magBatchdocumentenRegenereren,
  magBatchinhoudWijzigen,
  productiekernFeatureActief,
  valideerBriefcontract,
  valideerBriefversie,
  valideerGeadresseerdeSnapshot,
  valideerPrintbatch,
  type BriefContract,
  type BriefversieContract,
  type GeadresseerdeSnapshot,
  type PrintbatchContract,
} from './productiekernContract';

const geadresseerde: GeadresseerdeSnapshot = {
  naam: 'Ramysh Bito',
  bedrijfsnaam: null,
  aanhef: 'Geachte heer Bito,',
  straatHuisnummer: 'Voorbeeldstraat 1',
  postcode: '5061AA',
  plaats: 'Oisterwijk',
  land: 'Nederland',
  bron: 'handmatig',
  verificatiestatus: 'handmatig_gecontroleerd',
  relatieId: 'rel-1',
};

const brief: BriefContract = {
  id: 'brief-1',
  briefnummer: 'BR2026000482',
  signaalId: 'sig-1',
  selectieId: 'sel-1',
  objectId: null,
  relatieId: 'rel-1',
  actieveVersie: 2,
  status: 'definitief',
  vervangingVanBriefId: null,
  definitiefOp: '2026-08-06T01:00:00Z',
  vergrendeldOp: null,
  annuleringsreden: null,
};

const versie: BriefversieContract = {
  id: 'versie-2',
  briefId: 'brief-1',
  versienummer: 2,
  status: 'actief',
  inhoud: {
    onderwerp: 'Betreft uw pand',
    brieftekst: 'Geachte heer Bito,',
    objectadres: 'Voorbeeldstraat 1',
    objectomschrijving: null,
    templateId: 'eigenaar-1',
    templateVersie: '2',
  },
  geadresseerde,
  bestandReferentie: null,
  createdAt: '2026-08-06T01:00:00Z',
  vervallenOp: null,
  verzondenOp: null,
};

const batch: PrintbatchContract = {
  id: 'batch-1',
  batchnummer: 'BAT2026080601',
  status: 'concept',
  documentversie: 1,
  aanvullingOpBatchId: null,
  printdatum: null,
  verzenddatum: null,
  geannuleerdOp: null,
  annuleringsreden: null,
};

describe('BUILD A productiekerncontract', () => {
  it('accepteert geldige brief-, versie- en batchcontracten', () => {
    expect(valideerBriefcontract(brief)).toEqual([]);
    expect(valideerBriefversie(versie)).toEqual([]);
    expect(valideerPrintbatch(batch)).toEqual([]);
  });

  it('vereist een volledige, historisch bruikbare geadresseerde-snapshot', () => {
    expect(valideerGeadresseerdeSnapshot({
      ...geadresseerde,
      naam: null,
      bedrijfsnaam: null,
      postcode: '',
      plaats: '',
    })).toEqual([
      'Naam of bedrijfsnaam is verplicht.',
      'Postcode is verplicht.',
      'Plaats is verplicht.',
    ]);
  });

  it('blokkeert definitieve of geannuleerde brieven zonder verplichte identiteit', () => {
    expect(valideerBriefcontract({
      ...brief,
      briefnummer: null,
    })).toContain('Een definitieve brief vereist een briefnummer.');

    expect(valideerBriefcontract({
      ...brief,
      status: 'geannuleerd',
      annuleringsreden: '   ',
    })).toContain('Een geannuleerde brief vereist een reden.');
  });

  it('vereist verzend- en vervaldatums bij immutabele versiestatussen', () => {
    expect(valideerBriefversie({
      ...versie,
      status: 'verzonden',
      verzondenOp: null,
    })).toContain('Een verzonden briefversie vereist een verzenddatum.');

    expect(valideerBriefversie({
      ...versie,
      status: 'vervallen',
      vervallenOp: null,
    })).toContain('Een vervallen briefversie vereist een vervaldatum.');
  });

  it('staat alleen expliciete voorwaartse batchovergangen toe', () => {
    expect(isGeldigeBatchovergang('concept', 'documenten_gegenereerd')).toBe(true);
    expect(isGeldigeBatchovergang('documenten_gegenereerd', 'concept')).toBe(true);
    expect(isGeldigeBatchovergang('documenten_gegenereerd', 'geprint')).toBe(true);
    expect(isGeldigeBatchovergang('geprint', 'gepost')).toBe(true);
    expect(isGeldigeBatchovergang('gepost', 'concept')).toBe(false);
    expect(isGeldigeBatchovergang('geannuleerd', 'concept')).toBe(false);
  });

  it('vergrendelt batchinhoud na documentgeneratie en regeneratie na printen', () => {
    expect(magBatchinhoudWijzigen('concept')).toBe(true);
    expect(magBatchinhoudWijzigen('documenten_gegenereerd')).toBe(false);
    expect(magBatchinhoudWijzigen('geprint')).toBe(false);

    expect(magBatchdocumentenRegenereren('documenten_gegenereerd')).toBe(true);
    expect(magBatchdocumentenRegenereren('geprint')).toBe(false);
    expect(magBatchdocumentenRegenereren('gepost')).toBe(false);
  });

  it('houdt de productiekern standaard uitgeschakeld', () => {
    expect(productiekernFeatureActief(undefined)).toBe(false);
    expect(productiekernFeatureActief(false)).toBe(false);
    expect(productiekernFeatureActief('TRUE')).toBe(false);
    expect(productiekernFeatureActief('true')).toBe(true);
  });

  it('vereist afzonderlijke print- en verzenddatums voor batchstatussen', () => {
    expect(valideerPrintbatch({
      ...batch,
      status: 'geprint',
      printdatum: null,
    })).toContain('Een geprinte batch vereist een printdatum.');

    expect(valideerPrintbatch({
      ...batch,
      status: 'gepost',
      printdatum: '2026-08-06T02:00:00Z',
      verzenddatum: null,
    })).toContain('Een geposte batch vereist een verzenddatum.');
  });
});
