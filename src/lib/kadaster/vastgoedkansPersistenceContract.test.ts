import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migratie = readFileSync('supabase/migrations/20260813070000_kadaster_data_records_vastgoedkans.sql', 'utf8');
const frontendTypes = readFileSync('src/lib/kadaster/types.ts', 'utf8');
const edgeTypes = readFileSync('supabase/functions/kadaster-objectinformatie/_types.ts', 'utf8');
const readHook = readFileSync('src/hooks/useKadasterDataRecords.tsx', 'utf8');
const objectHook = readFileSync('src/hooks/useKadasterObjectinformatie.tsx', 'utf8');

describe('BUILD 2.0B.1 Kadaster Vastgoedkans persistencecontract', () => {
  it('breidt de bestaande Kadasterrecordtabel additief uit met Vastgoedkans als derde bron', () => {
    expect(migratie).toContain('ADD COLUMN IF NOT EXISTS vastgoedkans_id uuid');
    expect(migratie).toContain('REFERENCES public.vastgoedkansen(id)');
    expect(migratie).toContain('ON DELETE SET NULL');
    expect(migratie).toContain('OR vastgoedkans_id IS NOT NULL');
    expect(migratie).toContain('idx_kadaster_records_vastgoedkans_product_fetched');
    expect(migratie).not.toContain('UPDATE public.kadaster_data_records');
    expect(migratie).not.toContain('DELETE FROM public.kadaster_data_records');
  });

  it('spiegelt vastgoedkans_id in frontend en Edge requestcontext', () => {
    expect(frontendTypes).toContain('vastgoedkans_id?: string | null');
    expect(edgeTypes).toContain('vastgoedkans_id?: string | null');
    expect(frontendTypes).toContain('Voor Vastgoedkansen ondersteunt 2.0B.1 nog geen PDF-opslag');
    expect(edgeTypes).toContain('Vastgoedkansen bieden includePdf daarom nog niet aan');
  });

  it('leest Vastgoedkans-records via dezelfde read-only Kadasterrecordbron', () => {
    expect(readHook).toContain("type KadasterBronKolom = 'object_id' | 'signaal_id' | 'vastgoedkans_id'");
    expect(readHook).toContain('useKadasterDataRecordsForVastgoedkans');
    expect(readHook).toContain("useKadasterDataRecordsVoorBron('vastgoedkans', 'vastgoedkans_id'");
    expect(readHook).not.toContain('.insert(');
    expect(readHook).not.toContain('.update(');
  });

  it('houdt de betaalde Kadastercall expliciet en zonder automatische retry', () => {
    expect(objectHook).toContain('retry: false');
    expect(objectHook).toContain("supabase.functions.invoke(\n        'kadaster-objectinformatie'");
    expect(objectHook).not.toContain('useEffect(');
  });
});
