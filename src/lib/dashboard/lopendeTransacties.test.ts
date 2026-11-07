import { describe, expect, it } from 'vitest';
import { bepaalLopendeTransacties, isLopendeFase, type TransactieInvoer } from './lopendeTransacties';

const now = new Date('2026-11-07T10:00:00');
type K = TransactieInvoer['kandidaten'][number];

const obj = (id: string, over: Partial<TransactieInvoer['objecten'][number]> = {}) => ({ id, titel: `Object ${id}`, status: 'beschikbaar', ...over });
let n = 0;
const kand = (objectId: string, pipelineFase: string, over: Partial<K> = {}): K =>
  ({ id: `k${++n}`, objectId, relatieId: `r-${objectId}`, pipelineFase, createdAt: '2026-11-01T09:00:00Z', updatedAt: '2026-11-01T09:00:00Z', ...over });
const lopend = (over: Partial<TransactieInvoer>) => bepaalLopendeTransacties({ objecten: [], kandidaten: [], ...over }, now);
const lijst = (over: Partial<TransactieInvoer>) => lopend(over).items;

describe('Lopende transacties — wat is lopend', () => {
  it('vanaf Bieding / prijsvoorstel tot en met Transport / closing', () => {
    expect(isLopendeFase('bezichtiging_geweest')).toBe(false);
    for (const f of ['indicatieve_bieding', 'onderhandeling', 'loi_ontvangen', 'due_diligence', 'koopovereenkomst_concept', 'koopovereenkomst_getekend', 'transport_closing']) {
      expect(isLopendeFase(f)).toBe(true);
    }
    expect(isLopendeFase('afgerond')).toBe(false);
    expect(isLopendeFase('afgevallen')).toBe(false);
  });

  it('geen opvulling met eerdere fases', () => {
    const r = lopend({ objecten: [obj('A'), obj('B')], kandidaten: [kand('A', 'onderhandeling'), kand('B', 'bezichtiging_geweest')] });
    expect(r.items.map(i => i.objectId)).toEqual(['A']);
    expect(r.totaal).toBe(1);
  });

  it('niet op gearchiveerde, verwijderde of afgesloten objecten', () => {
    const objecten = [obj('A', { isArchived: true }), obj('B', { softDeletedAt: '2026-10-01' }), obj('C', { status: 'verkocht' }), obj('D', { status: 'ingetrokken' }), obj('E', { status: 'afgevallen' })];
    const r = lopend({ objecten, kandidaten: objecten.map(o => kand(o.id, 'koopovereenkomst_concept')) });
    expect(r.items).toEqual([]);
  });

  it('on hold blijft zichtbaar, met vlag', () => {
    const [t] = lijst({ objecten: [obj('H', { status: 'on_hold' })], kandidaten: [kand('H', 'indicatieve_bieding')] });
    expect(t.objectOnHold).toBe(true);
  });

  it('kandidaat zonder bekend object telt niet', () => {
    expect(lopend({ kandidaten: [kand('X', 'onderhandeling')] }).items).toEqual([]);
  });
});

describe('Lopende transacties — één regel per object, maximaal drie', () => {
  it('kiest per object de verst gevorderde kandidaat', () => {
    const r = lopend({
      objecten: [obj('A')],
      kandidaten: [kand('A', 'indicatieve_bieding', { relatieId: 'r1' }), kand('A', 'due_diligence', { relatieId: 'r2' }), kand('A', 'onderhandeling', { relatieId: 'r3' })],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].relatieId).toBe('r2');
    expect(r.items[0].faseLabel).toBe('Due diligence');
  });

  it('maximaal drie, totaal telt alle objecten', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const r = lopend({ objecten: ids.map(i => obj(i)), kandidaten: ids.map(i => kand(i, 'onderhandeling')) });
    expect(r.items).toHaveLength(3);
    expect(r.totaal).toBe(4);
  });
});

describe('Lopende transacties — rangschikking', () => {
  it('1. fase, verst eerst', () => {
    const r = lopend({
      objecten: ['A', 'B', 'C'].map(i => obj(i)),
      kandidaten: [kand('A', 'indicatieve_bieding'), kand('B', 'transport_closing'), kand('C', 'koopovereenkomst_getekend')],
    });
    expect(r.items.map(i => i.objectId)).toEqual(['B', 'C', 'A']);
  });

  it('2. bij gelijke fase de eerstvolgende concrete mijlpaal (levering of actie met datum)', () => {
    const r = lopend({
      objecten: ['A', 'B', 'C'].map(i => obj(i)),
      kandidaten: [
        kand('A', 'onderhandeling', { volgendeActieDatum: '2026-11-20', volgendeActieOmschrijving: 'Bellen' }),
        kand('B', 'onderhandeling', { gewensteLevering: '2026-11-12' }),
        kand('C', 'onderhandeling'),
      ],
    });
    expect(r.items.map(i => i.objectId)).toEqual(['B', 'A', 'C']);
    expect(r.items[0].mijlpaal).toEqual({ soort: 'levering', datum: '2026-11-12', verlopen: false });
  });

  it('3. daarna de meest recente betekenisvolle activiteit', () => {
    const r = lopend({
      objecten: ['A', 'B'].map(i => obj(i)),
      kandidaten: [kand('A', 'onderhandeling', { updatedAt: '2026-10-01T09:00:00Z', createdAt: '2026-10-01T09:00:00Z' }), kand('B', 'onderhandeling', { updatedAt: '2026-11-06T09:00:00Z' })],
    });
    expect(r.items.map(i => i.objectId)).toEqual(['B', 'A']);
  });

  it('stilgevallen trajecten zakken niet: fase gaat voor', () => {
    const r = lopend({
      objecten: ['A', 'B'].map(i => obj(i)),
      kandidaten: [
        kand('A', 'koopovereenkomst_concept', { createdAt: '2026-09-01T09:00:00Z', updatedAt: '2026-09-01T09:00:00Z' }),
        kand('B', 'onderhandeling', { updatedAt: '2026-11-06T09:00:00Z' }),
      ],
    });
    expect(r.items.map(i => i.objectId)).toEqual(['A', 'B']);
    expect(r.items[0].stilDagen).toBe(67);
    expect(r.items[1].stilDagen).toBeNull();
  });
});

describe('Lopende transacties — gegevens per traject', () => {
  it('stil-label alleen boven 14 dagen; systeemmomenten tellen niet, handmatige wel', () => {
    const basis = { objecten: [obj('A')], kandidaten: [kand('A', 'onderhandeling', { createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z' })] };
    expect(lopend(basis).items[0].stilDagen).toBe(37);
    expect(lopend({ ...basis, contactMoments: [{ objectId: 'A', momentDate: '2026-11-05', isSystem: true }] }).items[0].stilDagen).toBe(37);
    expect(lopend({ ...basis, contactMoments: [{ objectId: 'A', momentDate: '2026-11-05', isSystem: false }] }).items[0].stilDagen).toBeNull();
    expect(lopend({ ...basis, contactMoments: [{ objectId: 'A', relatieId: 'iemand-anders', momentDate: '2026-11-05', isSystem: false }] }).items[0].stilDagen).toBe(37);
  });

  it('koper, levering, volgende actie en laatste bod als context; niets verzonnen', () => {
    const [t] = lijst({
      objecten: [obj('A')],
      kandidaten: [kand('A', 'onderhandeling', { relatieId: 'r1', gewensteLevering: '2027-02-01', volgendeActie: 'bellen', volgendeActieDatum: '2026-11-10' })],
      biedingen: [
        { objectId: 'A', relatieId: 'r1', bedrag: 1_200_000, bieddatum: '2026-11-03', status: 'tegenvoorstel_gedaan', createdAt: '2026-11-03', updatedAt: '2026-11-03' },
        { objectId: 'A', relatieId: 'r1', bedrag: 1_100_000, bieddatum: '2026-10-20', status: 'afgewezen', createdAt: '2026-10-20', updatedAt: '2026-10-20' },
        { objectId: 'A', relatieId: 'r2', bedrag: 1_300_000, bieddatum: '2026-11-05', status: 'ontvangen', createdAt: '2026-11-05', updatedAt: '2026-11-05' },
      ],
      relatieNaam: id => (id === 'r1' ? 'Koper BV' : null),
      actieLabel: t => (t === 'bellen' ? 'Bellen' : null),
    });
    expect(t.koper).toBe('Koper BV');
    expect(t.gewensteLevering).toBe('2027-02-01');
    expect(t.volgendeActie).toEqual({ tekst: 'Bellen', datum: '2026-11-10' });
    expect(t.mijlpaal).toEqual({ soort: 'actie', datum: '2026-11-10', verlopen: false });
    expect(t.laatsteBod).toEqual({ bedrag: 1_200_000, datum: '2026-11-03', status: 'tegenvoorstel_gedaan' });

    const [leeg] = lijst({ objecten: [obj('B')], kandidaten: [kand('B', 'indicatieve_bieding')] });
    expect(leeg.koper).toBeNull();
    expect(leeg.gewensteLevering).toBeNull();
    expect(leeg.mijlpaal).toBeNull();
    expect(leeg.volgendeActie).toBeNull();
    expect(leeg.laatsteBod).toBeNull();
  });

  it('zonder actie bij de kandidaat: vroegste open taak op het object', () => {
    const [t] = lijst({
      objecten: [obj('A')],
      kandidaten: [kand('A', 'onderhandeling')],
      taken: [
        { id: 't1', titel: 'Later', objectId: 'A', deadline: '2026-11-25', status: 'open' },
        { id: 't2', titel: 'Concept KO sturen', objectId: 'A', deadline: '2026-11-12', status: 'open' },
        { id: 't3', titel: 'Klaar', objectId: 'A', deadline: '2026-11-08', status: 'afgerond' },
      ],
    });
    expect(t.volgendeActie).toEqual({ tekst: 'Concept KO sturen', datum: '2026-11-12' });
  });

  it('verstreken mijlpaal wordt als verlopen gemarkeerd', () => {
    const [t] = lijst({ objecten: [obj('A')], kandidaten: [kand('A', 'onderhandeling', { volgendeActieDatum: '2026-11-01', volgendeActieOmschrijving: 'Terugbellen' })] });
    expect(t.mijlpaal).toEqual({ soort: 'actie', datum: '2026-11-01', verlopen: true });
  });

  it('geen kanspercentage in de uitvoer', () => {
    const [t] = lijst({ objecten: [obj('A')], kandidaten: [kand('A', 'onderhandeling')] });
    expect(JSON.stringify(t)).not.toMatch(/kans|probab|procent/i);
  });
});
