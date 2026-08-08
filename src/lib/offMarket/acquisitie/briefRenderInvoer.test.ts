import { describe, expect, it } from 'vitest';

import { bouwBriefRenderInvoer } from './briefRenderInvoer';
import type { BriefContract, BriefversieContract } from './productiekernContract';

const brief: BriefContract = {
  id: 'brief-1', briefnummer: 'BR2026000482', signaalId: 'signaal-1',
  selectieId: 'selectie-1', objectId: null, relatieId: null, actieveVersie: 2,
  status: 'definitief', vervangingVanBriefId: null,
  definitiefOp: '2026-08-06T12:00:00Z', vergrendeldOp: '2026-08-06T12:00:00Z',
  annuleringsreden: null,
};

const versie: BriefversieContract = {
  id: 'versie-2', briefId: 'brief-1', versienummer: 2, status: 'actief',
  inhoud: {
    onderwerp: 'Uw pand', brieftekst: 'Geachte heer/mevrouw,',
    objectadres: 'Objectstraat 1', objectomschrijving: null,
    templateId: 'template-1', templateVersie: '1',
  },
  geadresseerde: {
    naam: 'Eigenaar', bedrijfsnaam: null, aanhef: 'Geachte heer/mevrouw,',
    straatHuisnummer: 'Straat 1', postcode: '1234AB', plaats: 'Amsterdam',
    land: 'Nederland', bron: 'handmatig', verificatiestatus: 'geverifieerd',
    relatieId: null,
  },
  bestandReferentie: null, createdAt: '2026-08-06T11:00:00Z',
  vervallenOp: null, verzondenOp: null,
};

describe('bouwBriefRenderInvoer', () => {
  it('bouwt een vaste payload uit de definitieve brief en actieve versie', () => {
    const resultaat = bouwBriefRenderInvoer({ brief, versie });
    expect(resultaat).toMatchObject({
      briefnummer: 'BR2026000482', briefVersieId: 'versie-2',
      versienummer: 2, objectadres: 'Objectstraat 1', naam: 'Eigenaar',
    });
    expect(Object.isFrozen(resultaat)).toBe(true);
  });

  it('weigert conceptbrieven, verkeerde versies en andere briefidentiteiten', () => {
    expect(() => bouwBriefRenderInvoer({ brief: { ...brief, status: 'concept', briefnummer: null, definitiefOp: null, vergrendeldOp: null }, versie }))
      .toThrow('Alleen een definitieve brief');
    expect(() => bouwBriefRenderInvoer({ brief, versie: { ...versie, versienummer: 1 } }))
      .toThrow('niet de actieve versie');
    expect(() => bouwBriefRenderInvoer({ brief, versie: { ...versie, briefId: 'brief-2' } }))
      .toThrow('hoort niet bij');
  });

  it('weigert een verzonden of vervallen versie voor nieuwe rendering', () => {
    expect(() => bouwBriefRenderInvoer({
      brief,
      versie: { ...versie, status: 'verzonden', verzondenOp: '2026-08-06T13:00:00Z' },
    })).toThrow('Alleen de actieve briefversie');
  });
});
