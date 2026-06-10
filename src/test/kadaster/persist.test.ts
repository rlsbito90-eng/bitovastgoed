// Test voor de persist-mapper van de Kadaster edge function.
// Importeert het Deno-module via een lokale relatieve URL — Vitest draait
// op Node, maar de mapper is puur synchrone TypeScript zonder Deno-APIs,
// dus de ./_persist.ts kan in deze test gewoon worden geladen.
import { describe, it, expect } from 'vitest';

// We re-implementeren hier de publieke verwachting: buildRow is intern,
// dus we testen via persistKadasterRecords' interface — maar zonder
// daadwerkelijk een Supabase-client te raken. Daarvoor stubben we client.
import { persistKadasterRecords } from '../../../supabase/functions/kadaster-objectinformatie/_persist.ts';

function maakStub() {
  const insertedRows: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      insert: (rows: Record<string, unknown>[]) => {
        insertedRows.push(...rows);
        return {
          select: () => Promise.resolve({
            data: rows.map((_, i) => ({ id: `id-${i}` })),
            error: null,
          }),
        };
      },
    }),
  };
  return { client, insertedRows };
}

describe('persistKadasterRecords', () => {
  it('schrijft koopsom-record met Kadaster-koopsom, niet als marktwaarde', async () => {
    const { client, insertedRows } = maakStub();
    await persistKadasterRecords(client as never, {
      objectId: '00000000-0000-0000-0000-000000000001',
      signaalId: null,
      mode: 'kadaster',
      fetchedAt: '2026-01-01T00:00:00Z',
      zoekadres: { type: 'pht', waarde: '1234AB 1' },
      userId: null,
      producten: [{
        code: 'waarde',
        beschikbaar: true,
        status: 'geleverd',
        data: { koopsom: 425000, koopJaar: 2019, koopsomValuta: 'EUR', meerOnroerendGoed: false },
      }],
    });
    expect(insertedRows).toHaveLength(1);
    const r = insertedRows[0];
    expect(r.product_code).toBe('waarde');
    expect(r.koopsom).toBe(425000);
    expect(r.koopjaar).toBe(2019);
    expect(r.meer_onroerend_goed).toBe(false);
    // Mag niet als marktwaarde/vraagprijs/taxatiewaarde worden opgeslagen
    expect(r).not.toHaveProperty('marktwaarde');
    expect(r).not.toHaveProperty('vraagprijs');
    expect(r).not.toHaveProperty('taxatiewaarde');
  });

  it('schrijft WOZ-objectgegevens, niet als WOZ-waarde', async () => {
    const { client, insertedRows } = maakStub();
    await persistKadasterRecords(client as never, {
      objectId: '00000000-0000-0000-0000-000000000001',
      signaalId: null,
      mode: 'kadaster',
      fetchedAt: '2026-01-01T00:00:00Z',
      zoekadres: { type: 'pht', waarde: '1234AB 1' },
      userId: null,
      producten: [{
        code: 'object',
        beschikbaar: true,
        status: 'geleverd',
        data: {
          bagObjectData: { bouwjaar: 1998, oppervlakteBag: 120, objectStatus: 'In gebruik' },
          wozObjecten: [{ wozObjectNummer: '0000123', oppervlakteWoz: 130, inhoud: 320 }],
          actualiteit: '2024-12-01',
        },
      }],
    });
    const r = insertedRows[0];
    expect(r.bag_bouwjaar).toBe(1998);
    expect(r.bag_oppervlakte).toBe(120);
    expect(r.woz_objectnummer).toBe('0000123');
    expect(r.woz_oppervlakte).toBe(130);
    expect(r.woz_inhoud).toBe(320);
    expect(r).not.toHaveProperty('woz_waarde');
  });

  it('schrijft rechten-record zonder relatiekoppeling', async () => {
    const { client, insertedRows } = maakStub();
    await persistKadasterRecords(client as never, {
      objectId: '00000000-0000-0000-0000-000000000001',
      signaalId: null,
      mode: 'kadaster',
      fetchedAt: '2026-01-01T00:00:00Z',
      zoekadres: { type: 'pht', waarde: '1234AB 1' },
      userId: null,
      producten: [{
        code: 'rechten',
        beschikbaar: true,
        status: 'geleverd',
        data: {
          rechthebbenden: [{
            persoon: { volledigeNaam: 'J. de Vries' },
            aandeel: { teller: 1, noemer: 2 },
            rechtsoort: 'Eigendom',
          }],
          kadastraleAanduiding: 'AMS B 1234',
        },
      }],
    });
    const r = insertedRows[0];
    expect(r.rechthebbende_naam).toBe('J. de Vries');
    expect(r.aandeel).toBe('1/2');
    expect(r.rechtsoort).toBe('Eigendom');
    expect(r.kadastrale_aanduiding).toBe('AMS B 1234');
    // Geen automatische relatiekoppeling
    expect(r).not.toHaveProperty('eigenaar_relatie_id');
    expect(r).not.toHaveProperty('relatie_id');
    expect(r).not.toHaveProperty('verkoper_relatie_id');
  });

  it('slaat product met status niet_geleverd ook op als poging', async () => {
    const { client, insertedRows } = maakStub();
    await persistKadasterRecords(client as never, {
      objectId: '00000000-0000-0000-0000-000000000001',
      signaalId: null,
      mode: 'kadaster',
      fetchedAt: '2026-01-01T00:00:00Z',
      zoekadres: { type: 'pht', waarde: '1234AB 1' },
      userId: null,
      producten: [{ code: 'waarde', beschikbaar: false, status: 'niet_geleverd' }],
    });
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe('niet_geleverd');
    expect(insertedRows[0].product_code).toBe('waarde');
  });
});
