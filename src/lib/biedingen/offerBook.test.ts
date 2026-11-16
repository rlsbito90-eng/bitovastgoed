import { describe, expect, it } from 'vitest';
import type { Bieding } from './types';
import { biedRondeLabel, bouwBiedboek } from './offerBook';

const bod = (patch: Partial<Bieding> = {}): Bieding => ({
  id: 'b1', objectId: 'o1', relatieId: 'r1', bedrag: 475000,
  currency: 'EUR', bieddatum: '2026-11-03', status: 'ontvangen',
  offerType: 'indicatief', financieringsvoorbehoud: 'geen', ddVoorbehoud: 'onbekend',
  richting: 'van_koper', isBestOffer: false, isFinalOffer: false,
  createdAt: '2026-11-03T10:00:00Z', updatedAt: '2026-11-03T10:00:00Z',
  ...patch,
});

describe('biedboek als onderhandelingsgesprek', () => {
  it('toont een kopersbod en een verkopersvoorstel in dezelfde tijdlijn', () => {
    const rondes = [
      bod(),
      bod({ id: 'b2', richting: 'van_verkoper', bedrag: 500000, status: 'tegenvoorstel_gedaan',
        offerType: 'tegenvoorstel', counterOfferToId: 'b1', bieddatum: '2026-11-04',
        createdAt: '2026-11-04T11:00:00Z' }),
    ];
    const [traject] = bouwBiedboek([...rondes].reverse());
    expect(traject.rondes.map(b => b.id)).toEqual(['b1', 'b2']);
    expect(traject.fase).toBe('wacht_op_koper');
    expect(traject.verschil).toBe(25000);
    expect(biedRondeLabel(traject.laatste)).toBe('Tegenvoorstel verkoper');
  });

  it('houdt een afgewezen bod zichtbaar, inclusief de reden', () => {
    const [traject] = bouwBiedboek([bod({ status: 'afgewezen', rejectedReason: 'Te laag' })]);
    expect(traject.isOpen).toBe(false);
    expect(traject.fase).toBe('afgewezen');
    expect(traject.rondes[0].rejectedReason).toBe('Te laag');
    expect(traject.momenten.map(m => m.soort)).toEqual(['bod', 'afwijzing']);
    expect(traject.momenten[1].datum).toBeNull();
  });

  it('verbergt historische biedingen niet wanneer een nieuw bod na afwijzing binnenkomt', () => {
    const [traject] = bouwBiedboek([
      bod({ status: 'afgewezen' }),
      bod({ id: 'b2', bieddatum: '2026-11-05', createdAt: '2026-11-05T08:00:00Z', bedrag: 480000 }),
    ]);
    expect(traject.rondes).toHaveLength(2);
    expect(traject.isOpen).toBe(true);
    expect(traject.laatsteKopersbod?.bedrag).toBe(480000);
  });


  it('registreert een afwijzing op de beslisdatum, ná het oorspronkelijke bod', () => {
    const [traject] = bouwBiedboek([
      bod({ status: 'afgewezen', rejectedReason: 'Te laag', rejectedAt: '2026-11-06T13:45:00Z' }),
      bod({ id: 'b2', richting: 'van_verkoper', bedrag: 500000, status: 'tegenvoorstel_gedaan',
        counterOfferToId: 'b1', bieddatum: '2026-11-04', createdAt: '2026-11-04T11:00:00Z' }),
    ]);
    expect(traject.momenten.map(m => m.soort)).toEqual(['bod', 'bod', 'afwijzing']);
    expect(traject.momenten[2].datum).toBe('2026-11-06T13:45:00Z');
    expect(traject.fase).toBe('afgewezen');
  });

  it('herkent verzoek om aangepast kopersbod als actie voor koper', () => {
    const [traject] = bouwBiedboek([bod({ status: 'aangepast_bod_gevraagd' })]);
    expect(traject.fase).toBe('wacht_op_koper');
  });

  it('houdt een kopersbod in behandeling open, zonder een nieuw bod te verzinnen', () => {
    const [traject] = bouwBiedboek([bod({ status: 'in_behandeling' })]);
    expect(traject.rondes).toHaveLength(1);
    expect(traject.isOpen).toBe(true);
    expect(traject.fase).toBe('wacht_op_verkoper');
  });

  it('scheidt kopers per object en objecten per koper', () => {
    const trajecten = bouwBiedboek([bod(), bod({ id: 'b2', relatieId: 'r2' }), bod({ id: 'b3', objectId: 'o2' })]);
    expect(trajecten).toHaveLength(3);
  });

  it('laat een afgerond traject niet open lijken door oudere actieve biedingen', () => {
    const [traject] = bouwBiedboek([
      bod(),
      bod({ id: 'b2', richting: 'van_verkoper', bieddatum: '2026-11-04', status: 'afgewezen',
        createdAt: '2026-11-04T11:00:00Z' }),
    ]);
    expect(traject.fase).toBe('afgewezen');
    expect(traject.verschil).toBeNull();
  });
});
