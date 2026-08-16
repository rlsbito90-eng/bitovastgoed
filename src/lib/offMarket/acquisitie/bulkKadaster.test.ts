import { describe, expect, it } from 'vitest';
import {
  bepaalBulkKadasterAdres,
  bouwBulkKadasterPreflight,
  bouwBulkKadasterPreflightMetBag,
} from './bulkKadaster';

function signaal(extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    titel: 'Zaanstraat 189',
    adres: 'Zaanstraat 189',
    postcode: '1013 RW',
    plaats: 'Amsterdam',
    ...extra,
  } as any;
}

describe('bepaalBulkKadasterAdres', () => {
  it('bouwt een eenduidig Kadasteradres', () => {
    const r = bepaalBulkKadasterAdres(signaal());
    expect(r.status).toBe('klaar');
    expect(r.adresInput).toMatchObject({ postalcode: '1013RW', houseNumber: '189' });
    expect(r.zoekadresLabel).toBe('1013RW 189');
  });

  it('blokkeert een dossier met meerdere mogelijke huisnummers', () => {
    const r = bepaalBulkKadasterAdres(signaal({ adres: 'Zaanstraat 189, 191' }));
    expect(r.status).toBe('geblokkeerd');
    expect(r.reden).toContain('Meerdere mogelijke huisnummers');
  });

  it('blokkeert een dossier zonder postcode zolang BAG nog niet is geraadpleegd', () => {
    const r = bepaalBulkKadasterAdres(signaal({ postcode: null }));
    expect(r.status).toBe('geblokkeerd');
  });
});

describe('bouwBulkKadasterPreflight', () => {
  it('slaat bestaande geleverde Rechten + PDF over', () => {
    const s = signaal();
    const fetched = '2026-08-16T10:00:00Z';
    const [r] = bouwBulkKadasterPreflight(
      [s],
      [{ id: 'rec-1', signaal_id: s.id, product_code: 'rechten', status: 'geleverd', fetched_at: fetched }],
      [{ id: 'doc-1', signaal_id: s.id, kadaster_data_record_id: 'rec-1', product_codes: ['rechten'], fetched_at: fetched }],
    );
    expect(r.status).toBe('aanwezig');
    expect(r.reden).toContain('geen nieuwe betaalde aanvraag');
  });

  it('vraagt niet opnieuw wanneer Rechten bestaan maar PDF ontbreekt', () => {
    const s = signaal();
    const [r] = bouwBulkKadasterPreflight(
      [s],
      [{ id: 'rec-1', signaal_id: s.id, product_code: 'rechten', status: 'geleverd', fetched_at: '2026-08-16T10:00:00Z' }],
      [],
    );
    expect(r.status).toBe('aanwezig');
    expect(r.reden).toContain('PDF-bericht ontbreekt');
  });

  it('markeert een dossier zonder bestaand Rechten-record voor aanvraag', () => {
    const [r] = bouwBulkKadasterPreflight([signaal()], [], []);
    expect(r.status).toBe('aanvragen');
  });
});

describe('bouwBulkKadasterPreflightMetBag', () => {
  it('herstelt een ontbrekende postcode via dezelfde gratis BAG-adreslogica', async () => {
    const s = signaal({
      titel: 'Haarlemmermeerstraat 117-119',
      adres: 'Haarlemmermeerstraat 117-119',
      postcode: null,
      plaats: 'Amsterdam',
    });
    const [r] = await bouwBulkKadasterPreflightMetBag([s], [], [], async (input) => {
      expect(input).toMatchObject({
        straat: 'Haarlemmermeerstraat',
        huisnummer: '117',
        plaats: 'Amsterdam',
      });
      return [{
        id: 'bag-117',
        weergavenaam: 'Haarlemmermeerstraat 117, 1058 JW Amsterdam',
        straat: 'Haarlemmermeerstraat',
        huisnummer: '117',
        huisletter: null,
        huisnummertoevoeging: null,
        postcode: '1058JW',
        woonplaats: 'Amsterdam',
        nummeraanduiding_id: '0363200012345678',
        adresseerbaar_object_id: '0363010000123456',
      }];
    });

    expect(r.status).toBe('aanvragen');
    expect(r.adresInput).toEqual({
      postalcode: '1058JW',
      houseNumber: '117',
      houseLetter: null,
      houseNumberAddition: null,
    });
    expect(r.zoekadresLabel).toBe('1058JW 117');
    expect(r.reden).toContain('BAG/PDOK');
  });

  it('past H → 1 → A voorkeur toe wanneer BAG meerdere varianten teruggeeft', async () => {
    const s = signaal({ adres: 'Agamemnonstraat 55', postcode: null, plaats: 'Amsterdam' });
    const basis = {
      weergavenaam: '', straat: 'Agamemnonstraat', huisnummer: '55', postcode: '1076LS',
      woonplaats: 'Amsterdam', nummeraanduiding_id: null, adresseerbaar_object_id: null,
    };
    const [r] = await bouwBulkKadasterPreflightMetBag([s], [], [], async () => [
      { ...basis, id: 'kaal', huisletter: null, huisnummertoevoeging: null },
      { ...basis, id: 'een', huisletter: null, huisnummertoevoeging: '1' },
      { ...basis, id: 'h', huisletter: 'H', huisnummertoevoeging: null },
    ]);

    expect(r.adresInput).toMatchObject({ postalcode: '1076LS', houseNumber: '55', houseLetter: 'H' });
    expect(r.zoekadresLabel).toBe('1076LS 55H');
  });

  it('doet geen BAG-call als Rechten al aanwezig zijn', async () => {
    const s = signaal({ postcode: null });
    let calls = 0;
    const [r] = await bouwBulkKadasterPreflightMetBag(
      [s],
      [{ id: 'rec-1', signaal_id: s.id, product_code: 'rechten', status: 'geleverd', fetched_at: '2026-08-16T10:00:00Z' }],
      [],
      async () => { calls += 1; return []; },
    );
    expect(r.status).toBe('aanwezig');
    expect(calls).toBe(0);
  });
});
