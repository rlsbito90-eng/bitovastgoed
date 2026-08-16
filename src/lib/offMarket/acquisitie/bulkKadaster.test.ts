import { describe, expect, it } from 'vitest';
import {
  bepaalBulkKadasterAdres,
  bouwBulkKadasterPreflight,
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

  it('blokkeert een dossier zonder postcode', () => {
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
