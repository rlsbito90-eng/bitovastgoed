import { describe, expect, it, vi } from 'vitest';
import type {
  BatchdocumentContract,
  BriefContract,
  BriefversieContract,
  PrintbatchContract,
} from './productiekernContract';
import {
  markeerProductiekernBatchGeprint,
  markeerProductiekernBrievenGepost,
  registreerProductiekernBatchdocumenten,
  startProductiekernPrintbatch,
  vernieuwProductiekernBatchdocumenten,
} from './productiekernPrintbatch';

const brief: BriefContract = {
  id: 'brief-1', briefnummer: 'BR2026000001', signaalId: 'sig-1', selectieId: 'sel-1',
  objectId: null, relatieId: null, actieveVersie: 1, status: 'definitief',
  vervangingVanBriefId: null, definitiefOp: '2026-08-16T19:00:00.000Z',
  vergrendeldOp: '2026-08-16T19:00:00.000Z', annuleringsreden: null,
};
const versie: BriefversieContract = {
  id: 'versie-1', briefId: 'brief-1', versienummer: 1, status: 'actief',
  inhoud: { onderwerp: 'Onderwerp', brieftekst: 'Tekst', objectadres: null, objectomschrijving: null, templateId: null, templateVersie: null },
  geadresseerde: { naam: 'E.S. Blok', bedrijfsnaam: null, aanhef: null, straatHuisnummer: 'Straat 1', postcode: '1012 AB', plaats: 'Amsterdam', land: 'Nederland', bron: 'test', verificatiestatus: 'onbekend', relatieId: null },
  bestandReferentie: null, createdAt: '2026-08-16T19:00:00.000Z', vervallenOp: null, verzondenOp: null,
};
const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026081601', status: 'concept', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null, geannuleerdOp: null, annuleringsreden: null,
};

function atomisch() {
  return {
    maakPrintbatchMetBrieven: vi.fn(async () => batch),
  };
}
function transacties() {
  return {
    maakBriefDefinitief: vi.fn(),
    registreerBatchdocumenten: vi.fn(async () => undefined),
    vernieuwBatchdocumenten: vi.fn(async () => undefined),
    markeerBatchGeprint: vi.fn(async () => undefined),
    markeerBriefGepost: vi.fn(async () => undefined),
  };
}

function docs(documentversie = 1): BatchdocumentContract[] {
  return (['batchvoorblad', 'controlelijst', 'brieven_pdf', 'adreslabels'] as const).map((documenttype, i) => ({
    id: `doc-${documentversie}-${i}`, batchId: 'batch-1', documentversie, documenttype,
    bestandReferentie: `off-market-productie/BAT2026081601/${documenttype}`,
    status: 'actief', metadata: {}, createdAt: '2026-08-16T20:00:00.000Z', vervallenOp: null,
  }));
}

describe('Productiekern printbatch', () => {
  it('reserveert één BAT plus alle immutable koppelingen in één repositorycall en bouwt vier documenttypen', async () => {
    const repo = atomisch();
    const resultaat = await startProductiekernPrintbatch({
      brieven: [{ brief, versie, geadresseerdeKey: 'sig-1|es-blok' }],
      actorId: 'actor-1', datum: '2026-08-16', operationScope: 'selectie-abc',
    }, repo);

    expect(repo.maakPrintbatchMetBrieven).toHaveBeenCalledTimes(1);
    expect(repo.maakPrintbatchMetBrieven).toHaveBeenCalledWith({
      actorId: 'actor-1',
      operationKey: 'printbatch:selectie-abc',
      datum: '2026-08-16',
      brieven: [{ briefId: 'brief-1', briefVersieId: 'versie-1' }],
    });
    expect(resultaat.plan.documenten.map(d => d.documenttype).sort()).toEqual(
      ['adreslabels', 'batchvoorblad', 'brieven_pdf', 'controlelijst'],
    );
  });

  it('weigert conceptbrief, verlopen versie en dubbele brief/versie vóór de atomische BAT-call', async () => {
    const repo = atomisch();
    await expect(startProductiekernPrintbatch({
      brieven: [{ brief: { ...brief, status: 'concept', briefnummer: null }, versie, geadresseerdeKey: 'x' }],
      actorId: 'actor', datum: '2026-08-16', operationScope: 'x',
    }, repo)).rejects.toThrow('Alleen definitieve brieven');
    await expect(startProductiekernPrintbatch({
      brieven: [{ brief, versie: { ...versie, status: 'vervallen', vervallenOp: '2026-08-16T20:00:00Z' }, geadresseerdeKey: 'x' }],
      actorId: 'actor', datum: '2026-08-16', operationScope: 'x',
    }, repo)).rejects.toThrow('actieve briefversie');
    await expect(startProductiekernPrintbatch({
      brieven: [
        { brief, versie, geadresseerdeKey: 'x' },
        { brief, versie, geadresseerdeKey: 'x' },
      ], actorId: 'actor', datum: '2026-08-16', operationScope: 'x',
    }, repo)).rejects.toThrow('dubbel');
    expect(repo.maakPrintbatchMetBrieven).not.toHaveBeenCalled();
  });

  it('registreert documenten pas als exact vier actieve opgeslagen artifacts voor dezelfde BAT/v1 aanwezig zijn', async () => {
    const tx = transacties();
    const repo = atomisch();
    const gestart = await startProductiekernPrintbatch({
      brieven: [{ brief, versie, geadresseerdeKey: 'x' }], actorId: 'actor', datum: '2026-08-16', operationScope: 'x',
    }, repo);

    await registreerProductiekernBatchdocumenten({
      batch, plan: gestart.plan, opgeslagenDocumenten: docs(), actorId: 'actor',
      uitgevoerdOp: '2026-08-16T20:00:00.000Z',
    }, tx);
    expect(tx.registreerBatchdocumenten).toHaveBeenCalledWith(expect.objectContaining({
      actie: 'batch_documenten_registreren',
      operationKey: 'batch-documenten:batch-1:v1',
      verwachtVersienummer: 1,
    }));

    await expect(registreerProductiekernBatchdocumenten({
      batch, plan: gestart.plan, opgeslagenDocumenten: docs().slice(0, 3), actorId: 'actor',
    }, tx)).rejects.toThrow('Exact vier');
  });

  it('markeert print en post alleen via expliciete transactionele acties', async () => {
    const tx = transacties();
    const documentenBatch = { ...batch, status: 'documenten_gegenereerd' as const };
    await markeerProductiekernBatchGeprint({
      batch: documentenBatch, actorId: 'actor', printdatum: '2026-08-16T20:10:00.000Z',
    }, tx);
    expect(tx.markeerBatchGeprint).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'batch-geprint:batch-1:v1', printdatum: '2026-08-16T20:10:00.000Z',
    }));

    const geprint = { ...batch, status: 'geprint' as const, printdatum: '2026-08-16T20:10:00.000Z' };
    await markeerProductiekernBrievenGepost({
      batch: geprint,
      brieven: [{ brief, versie, geadresseerdeKey: 'sig-1|es-blok' }],
      actorId: 'actor', verzenddatum: '2026-08-16T20:20:00.000Z',
    }, tx);
    expect(tx.markeerBriefGepost).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'brief-gepost:batch-1:versie-1',
      geadresseerdeKey: 'sig-1|es-blok',
      verzenddatum: '2026-08-16T20:20:00.000Z',
    }));
  });

  it('vernieuwt een nog niet geprinte BAT atomisch naar exact de volgende documentversie', async () => {
    const tx = transacties();
    const documentenBatch = { ...batch, status: 'documenten_gegenereerd' as const };
    const gestart = await startProductiekernPrintbatch({
      brieven: [{ brief, versie, geadresseerdeKey: 'x' }],
      actorId: 'actor', datum: '2026-08-16', operationScope: 'vernieuwen',
    }, atomisch());
    const planV2 = {
      ...gestart.plan,
      documentversie: 2,
      documenten: gestart.plan.documenten.map((document) => ({
        ...document,
        documentversie: 2,
        bestandsnaam: document.bestandsnaam.replace('-v1-', '-v2-'),
      })),
    };

    await expect(vernieuwProductiekernBatchdocumenten({
      batch: documentenBatch,
      plan: planV2,
      opgeslagenDocumenten: docs(2),
      actorId: 'actor',
      reden: 'Huisstijlherstel',
      uitgevoerdOp: '2026-08-16T20:05:00.000Z',
    }, tx)).resolves.toMatchObject({ documentversie: 2, status: 'documenten_gegenereerd' });

    expect(tx.vernieuwBatchdocumenten).toHaveBeenCalledWith(expect.objectContaining({
      actie: 'batch_documentversie_vernieuwen',
      operationKey: 'batch-documentversie:batch-1:v2',
      verwachtVersienummer: 1,
      nieuweDocumentversie: 2,
      reden: 'Huisstijlherstel',
    }));

    await expect(vernieuwProductiekernBatchdocumenten({
      batch: { ...documentenBatch, status: 'geprint', printdatum: '2026-08-16T20:10:00.000Z' },
      plan: planV2,
      opgeslagenDocumenten: docs(2),
      actorId: 'actor',
      reden: 'Te laat',
    }, tx)).rejects.toThrow('nog niet geprinte batch');
  });
});
