import { describe, expect, it } from 'vitest';
import { bepaalAandacht, type AandachtInvoer } from './aandacht';

const now = new Date('2026-11-07T10:00:00');

type Bod = AandachtInvoer['biedingen'][number];
const obj = (id: string, over: Partial<AandachtInvoer['objecten'][number]> = {}) =>
  ({ id, titel: `Object ${id}`, status: 'beschikbaar', datumToegevoegd: '2026-09-01', ...over });
const kandidaat = (objectId: string, over: Partial<AandachtInvoer['kandidaten'][number]> = {}) =>
  ({ objectId, relatieId: 'r1', pipelineFase: 'teaser_verstuurd', createdAt: '2026-11-05T09:00:00Z', ...over });
const bod = (objectId: string, over: Partial<Bod> = {}): Bod =>
  ({ id: `b-${objectId}`, objectId, relatieId: 'r1', bedrag: 1_000_000, bieddatum: '2026-11-05', status: 'ontvangen', richting: 'van_koper', geldigTot: null, createdAt: '2026-11-05T09:00:00Z', updatedAt: '2026-11-05T09:00:00Z', ...over });

const invoer = (over: Partial<AandachtInvoer>): AandachtInvoer => ({
  objecten: [], kandidaten: [], biedingen: [], contactMoments: [], taken: [], deals: [], matches: [], aantalZoekprofielen: 3, ...over,
});
const items = (over: Partial<AandachtInvoer>) => bepaalAandacht(invoer(over), now).items;

describe('Aandacht nodig — open bieding', () => {
  it('toont een ontvangen bod met concrete vervolgstap', () => {
    const [item] = items({ objecten: [obj('A')], kandidaten: [kandidaat('A')], biedingen: [bod('A')] });
    expect(item.signaal).toBe('open_bieding');
    expect(item.label).toBe('Open bieding');
    expect(item.toelichting).toBe('Ontvangen bod, reactie verkoper nodig');
    expect(item.volgendeActie).toBe('verkoper opvolgen');
  });

  it('telt alle vier actieve statussen mee, maar niet concept, afgewezen of verlopen', () => {
    for (const status of ['ontvangen', 'in_behandeling', 'tegenvoorstel_gedaan', 'aangepast_bod_gevraagd'] as const) {
      expect(items({ objecten: [obj('A')], kandidaten: [kandidaat('A')], biedingen: [bod('A', { status })] })[0]?.signaal).toBe('open_bieding');
    }
    for (const status of ['concept', 'afgewezen', 'geaccepteerd', 'ingetrokken'] as const) {
      expect(items({ objecten: [obj('A')], kandidaten: [kandidaat('A')], biedingen: [bod('A', { status: status as Bod['status'] })] })).toEqual([]);
    }
    expect(items({ objecten: [obj('A')], kandidaten: [kandidaat('A')], biedingen: [bod('A', { geldigTot: '2026-11-01' })] })).toEqual([]);
  });

  it('noemt een tegenvoorstel zonder bedrag', () => {
    const [item] = items({ objecten: [obj('A')], kandidaten: [kandidaat('A')], biedingen: [bod('A', { status: 'tegenvoorstel_gedaan', bedrag: null })] });
    expect(item.toelichting).toBe('Tegenvoorstel zonder bedrag');
    expect(item.volgendeActie).toBe('bedrag van het tegenvoorstel vastleggen');
  });

  it('alleen voor actieve objecten', () => {
    for (const status of ['verkocht', 'ingetrokken', 'afgevallen']) {
      expect(items({ objecten: [obj('A', { status })], biedingen: [bod('A')] })).toEqual([]);
    }
    expect(items({ objecten: [obj('A', { isArchived: true })], biedingen: [bod('A')] })).toEqual([]);
  });

  it('een geplande taak wordt de vervolgstap, het bod blijft zichtbaar', () => {
    const [item] = items({
      objecten: [obj('A')], kandidaten: [kandidaat('A')], biedingen: [bod('A')],
      taken: [{ id: 't1', titel: 'Bod bespreken met verkoper', objectId: 'A', deadline: '2026-11-10', status: 'open' }],
    });
    expect(item.signaal).toBe('open_bieding');
    expect(item.volgendeActie).toMatch(/^Bod bespreken met verkoper \(gepland /);
  });
});

describe('Aandacht nodig — geen activiteit', () => {
  it('meer dan 14 dagen zonder activiteit', () => {
    const [item] = items({ objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-22T09:00:00Z' })] });
    expect(item.signaal).toBe('geen_activiteit');
    expect(item.label).toBe('16 dagen geen activiteit');
    expect(item.toelichting).toContain('Geen betekenisvolle opvolging geregistreerd');
    expect(item.volgendeActie).toBe('kandidaat benaderen');
  });

  it('precies 14 dagen is nog geen signaal', () => {
    expect(items({ objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-24T09:00:00Z' })] })).toEqual([]);
  });

  it('systeemcontactmomenten tellen niet als activiteit, handmatige wel', () => {
    const basis = { objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z' })] };
    expect(items({ ...basis, contactMoments: [{ objectId: 'B', momentDate: '2026-11-06', isSystem: true }] })[0]?.signaal).toBe('geen_activiteit');
    expect(items({ ...basis, contactMoments: [{ objectId: 'B', momentDate: '2026-11-06', isSystem: false }] })).toEqual([]);
  });

  it('datums in de toekomst tellen niet als activiteit', () => {
    const r = items({ objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z' })], contactMoments: [{ objectId: 'B', momentDate: '2026-12-01', isSystem: false }] });
    expect(r[0]?.signaal).toBe('geen_activiteit');
  });

  it('bij een open bod geldt 7 dagen; het telt als extra signaal', () => {
    const [item] = items({
      objecten: [obj('A')], kandidaten: [kandidaat('A', { createdAt: '2026-10-20T09:00:00Z' })],
      biedingen: [bod('A', { bieddatum: '2026-10-29', createdAt: '2026-10-29T09:00:00Z', updatedAt: '2026-10-29T09:00:00Z' })],
    });
    expect(item.signaal).toBe('open_bieding');
    expect(item.extraSignalen).toBe(1);
    expect(item.overigeSignalen).toEqual(['9 dagen geen activiteit']);
  });

  it('een geplande opvolging (taak of volgende actie bij kandidaat) haalt het object weg', () => {
    const basis = { objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z' })] };
    expect(items({ ...basis, taken: [{ id: 't', titel: 'Bellen', objectId: 'B', deadline: '2026-11-07', status: 'open' }] })).toEqual([]);
    expect(items({ objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z', volgendeActieDatum: '2026-11-12' })] })).toEqual([]);
  });

  it('plandatum uit de Taken-module gaat voor de deadline', () => {
    const basis = { objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z' })] };
    const taken = [{ id: 't', titel: 'Bellen', objectId: 'B', deadline: '2026-11-20', status: 'open' }];
    const [item] = items({ ...basis, taken, planDatumVoor: () => '2026-11-03' });
    expect(item.volgendeActie).toMatch(/^Bellen \(achterstallig sinds /);
  });

  it('afgeronde, geannuleerde en verwijderde taken tellen niet als opvolging', () => {
    const basis = { objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z' })] };
    for (const t of [{ status: 'afgerond' }, { status: 'geannuleerd' }, { status: 'open', softDeletedAt: '2026-11-01' }]) {
      expect(items({ ...basis, taken: [{ id: 't', titel: 'x', objectId: 'B', deadline: '2026-11-10', ...t }] })[0]?.signaal).toBe('geen_activiteit');
    }
  });
});

describe('Aandacht nodig — geen kandidaat', () => {
  it('met passende geregistreerde zoekprofielen', () => {
    const [item] = items({ objecten: [obj('C', { datumToegevoegd: '2026-11-01' })], matches: [{ objectId: 'C', relatieId: 'r1' }, { objectId: 'C', relatieId: 'r2' }, { objectId: 'C', relatieId: 'r2' }] });
    expect(item.signaal).toBe('geen_kandidaat');
    expect(item.toelichting).toBe('Geen geïnteresseerde partij gekoppeld · 2 relaties passen op een geregistreerd zoekprofiel');
    expect(item.volgendeActie).toBe('passende relaties benaderen');
  });

  it('zonder match spreekt het uitsluitend over geregistreerde zoekprofielen', () => {
    const [item] = items({ objecten: [obj('C', { datumToegevoegd: '2026-11-01' })], aantalZoekprofielen: 12 });
    expect(item.toelichting).toBe('Geen geïnteresseerde partij gekoppeld · geen match op de 12 geregistreerde zoekprofielen');
    expect(item.volgendeActie).toBe('kandidaten zoeken buiten de geregistreerde zoekprofielen');
    expect(item.toelichting).not.toMatch(/geen koper/i);
  });

  it('afgevallen kandidaten tellen niet; een actieve deal wel', () => {
    const o = obj('C', { datumToegevoegd: '2026-11-01' });
    expect(items({ objecten: [o], kandidaten: [kandidaat('C', { pipelineFase: 'afgevallen' })] })[0]?.signaal).toBe('geen_kandidaat');
    expect(items({ objecten: [o], deals: [{ objectId: 'C', fase: 'bezichtiging' }] })).toEqual([]);
  });

  it('niet bij objecten die nog beoordeeld worden', () => {
    expect(items({ objecten: [obj('C', { status: 'te_beoordelen', datumToegevoegd: '2026-11-01' })] })).toEqual([]);
  });
});

describe('Aandacht nodig — één regel per object, volgorde en on hold', () => {
  it('toont elk object één keer met het belangrijkste signaal', () => {
    const r = items({ objecten: [obj('X', { datumToegevoegd: '2026-09-01' })] });
    expect(r).toHaveLength(1);
    expect(r[0].signaal).toBe('geen_activiteit');
    expect(r[0].label).toBe('67 dagen sinds toevoegen, geen activiteit');
    expect(r[0].overigeSignalen).toEqual(['Geen kandidaat']);
  });

  it('sorteert: open biedingen, dan langste stilte, dan geen kandidaat', () => {
    const r = items({
      objecten: [obj('kand', { datumToegevoegd: '2026-11-05' }), obj('stil20'), obj('stil40'), obj('bod')],
      kandidaten: [kandidaat('stil20', { createdAt: '2026-10-18T09:00:00Z' }), kandidaat('stil40', { createdAt: '2026-09-28T09:00:00Z' }), kandidaat('bod')],
      biedingen: [bod('bod')],
    });
    expect(r.map(i => i.objectId)).toEqual(['bod', 'stil40', 'stil20', 'kand']);
  });

  it('on hold staat apart, ook bij open bod', () => {
    const o = bepaalAandacht(invoer({ objecten: [obj('H', { status: 'on_hold' })], biedingen: [bod('H')] }), now);
    expect(o.items).toEqual([]);
    expect(o.onHold).toHaveLength(1);
    expect(o.onHold[0].volgendeActie).toBe('beoordelen of het object weer actief kan');
  });
});

describe('Aandacht nodig — achterstallige opvolging blijft zichtbaar (regressie)', () => {
  const stilObject = { objecten: [obj('B')], kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z' })] };
  const taak = (id: string, over: Partial<AandachtInvoer['taken'][number]>) =>
    ({ id, titel: id, objectId: 'B', deadline: null, status: 'open', ...over });

  it('een toekomstige afspraak laat een achterstallige taak niet verdwijnen', () => {
    const [item] = items({ ...stilObject, taken: [taak('Oud', { deadline: '2026-11-02' }), taak('Nieuw', { deadline: '2026-11-12' })] });
    expect(item?.signaal).toBe('geen_activiteit');
    expect(item.volgendeActie).toMatch(/^Oud \(deadline verstreken op /);
  });

  it('ook niet bij een achterstallige volgende actie van een kandidaat', () => {
    const r = items({
      objecten: [obj('B')],
      kandidaten: [kandidaat('B', { createdAt: '2026-10-01T09:00:00Z', volgendeActieDatum: '2026-11-01', volgendeActieOmschrijving: 'Terugbellen' })],
      taken: [taak('Nieuw', { deadline: '2026-11-12' })],
    });
    expect(r[0]?.volgendeActie).toMatch(/^Terugbellen \(achterstallig sinds /);
  });

  it('een verstreken harde deadline gaat voor op een latere plandatum van dezelfde taak', () => {
    const [item] = items({ ...stilObject, taken: [taak('Contract', { deadline: '2026-11-04' })], planDatumVoor: () => '2026-11-10' });
    expect(item?.signaal).toBe('geen_activiteit');
    expect(item.volgendeActie).toMatch(/^Contract \(deadline verstreken op /);
  });

  it('de vroegste achterstallige stap komt eerst, ook als dat een plandatum is', () => {
    const plannen: Record<string, string> = { Plan: '2026-11-02' };
    const [item] = items({
      ...stilObject,
      taken: [taak('Plan', {}), taak('Deadline', { deadline: '2026-11-05' })],
      planDatumVoor: t => plannen[t.id] ?? null,
    });
    expect(item.volgendeActie).toMatch(/^Plan \(achterstallig sinds /);
  });

  it('bij dezelfde datum gaat de harde deadline voor', () => {
    const plannen: Record<string, string> = { Plan: '2026-11-04' };
    const [item] = items({
      ...stilObject,
      taken: [taak('Plan', {}), taak('Deadline', { deadline: '2026-11-04' })],
      planDatumVoor: t => plannen[t.id] ?? null,
    });
    expect(item.volgendeActie).toMatch(/^Deadline \(deadline verstreken op /);
  });

  it('alleen een toekomstige afspraak, zonder achterstand, haalt het object weg', () => {
    expect(items({ ...stilObject, taken: [taak('Nieuw', { deadline: '2026-11-12' })] })).toEqual([]);
  });

  it('geen kandidaat blijft ook staan bij een achterstallige stap', () => {
    const r = items({ objecten: [obj('C', { datumToegevoegd: '2026-11-01' })], taken: [taak('Oud', { objectId: 'C', deadline: '2026-11-03' }), taak('Nieuw', { objectId: 'C', deadline: '2026-11-20' })] });
    expect(r[0]?.signaal).toBe('geen_kandidaat');
  });
});

describe('Aandacht nodig — gegevens bij open bieding', () => {
  it('geeft bedrag, partij, bieddatum en geldigheid door', () => {
    const [item] = items({
      objecten: [obj('A')], kandidaten: [kandidaat('A')],
      biedingen: [bod('A', { relatieId: 'r9', bedrag: 1_250_000, geldigTot: '2026-11-14' })],
      relatieNaam: id => (id === 'r9' ? 'Beleggings BV' : null),
    });
    expect(item.bod).toEqual({ bedrag: 1_250_000, relatieId: 'r9', partij: 'Beleggings BV', bieddatum: '2026-11-05', geldigTot: '2026-11-14' });
  });

  it('verzint niets: onbekende partij, bedrag en geldigheid blijven leeg', () => {
    const [item] = items({ objecten: [obj('A')], kandidaten: [kandidaat('A')], biedingen: [bod('A', { relatieId: 'onbekend', bedrag: null })], relatieNaam: () => null });
    expect(item.bod).toEqual({ bedrag: null, relatieId: 'onbekend', partij: null, bieddatum: '2026-11-05', geldigTot: null });
  });

  it('andere signalen hebben geen bodgegevens', () => {
    const [item] = items({ objecten: [obj('C', { datumToegevoegd: '2026-11-01' })] });
    expect(item.bod).toBeUndefined();
  });
});
