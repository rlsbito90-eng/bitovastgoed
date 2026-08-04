import { describe, expect, it } from 'vitest';
import { preflightObjectIdentitySourceAdapters } from './sourceAdapterPreflight';

const completeSchema = [
  ['vastgoedkansen', ['id', 'bag_verblijfsobject_id', 'bag_pand_id', 'adres', 'postcode', 'plaats', 'object_id']],
  ['objecten', ['id', 'bag_verblijfsobject_id', 'bag_pand_id', 'adres', 'postcode', 'plaats', 'crm_objectregistratie_id']],
  ['off_market_signalen', ['id', 'bag_verblijfsobject_id', 'bag_pand_id', 'adres', 'postcode', 'plaats', 'object_id']],
  ['deals', ['id', 'bag_verblijfsobject_id', 'bag_pand_id', 'adres', 'postcode', 'plaats', 'object_id']],
  ['acquisitie_targets', ['id', 'bag_verblijfsobject_id', 'bag_pand_id', 'adres', 'postcode', 'plaats', 'object_id']],
].map(([table, columns]) => ({ table: table as string, columns: columns as string[] }));

describe('Object-ID bronadapterpreflight', () => {
  it('is read-only en groen bij volledige brondekking', () => {
    expect(preflightObjectIdentitySourceAdapters(completeSchema)).toEqual({
      status: 'preflight_ready',
      readOnly: true,
      writes: 0,
      issues: [],
    });
  });

  it('blokkeert bij ontbrekende tabel', () => {
    const result = preflightObjectIdentitySourceAdapters(
      completeSchema.filter(item => item.table !== 'deals'),
    );
    expect(result.status).toBe('preflight_blocked');
    expect(result.issues).toContainEqual(expect.objectContaining({
      sourceType: 'deal',
      code: 'missing_table',
    }));
  });

  it('blokkeert bij ontbrekende primaire sleutel', () => {
    const schema = completeSchema.map(item =>
      item.table === 'objecten'
        ? { ...item, columns: item.columns.filter(column => column !== 'id') }
        : item,
    );
    const result = preflightObjectIdentitySourceAdapters(schema);
    expect(result.issues).toContainEqual(expect.objectContaining({
      sourceType: 'object',
      code: 'missing_required_column',
    }));
  });

  it('accepteert volledig adres als gecontroleerde fallback zonder BAG-kolommen', () => {
    const schema = completeSchema.map(item =>
      item.table === 'objecten'
        ? { table: item.table, columns: ['id', 'adres', 'postcode', 'plaats'] }
        : item,
    );
    expect(preflightObjectIdentitySourceAdapters(schema).issues).not.toContainEqual(
      expect.objectContaining({ sourceType: 'object', code: 'no_identity_path' }),
    );
  });

  it('blokkeert wanneer BAG en volledig adres beide ontbreken', () => {
    const schema = completeSchema.map(item =>
      item.table === 'objecten'
        ? { table: item.table, columns: ['id', 'adres'] }
        : item,
    );
    const result = preflightObjectIdentitySourceAdapters(schema);
    expect(result.issues).toContainEqual(expect.objectContaining({
      sourceType: 'object',
      code: 'no_identity_path',
    }));
  });
});
