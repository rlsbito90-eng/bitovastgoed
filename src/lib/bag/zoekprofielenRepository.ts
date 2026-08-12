import { supabase } from '@/integrations/supabase/client';
import type { BagZoekprofiel } from './pandenverkennerPersistence';

interface ZoekprofielRij {
  id: string;
  naam: string;
  scope_code: string;
  server_filters: BagZoekprofiel['serverFilters'];
  filters: BagZoekprofiel['filters'];
  created_at: string;
  updated_at: string;
}

function naarProfiel(row: ZoekprofielRij): BagZoekprofiel {
  return {
    id: row.id,
    naam: row.naam,
    scopeCode: row.scope_code,
    serverFilters: row.server_filters,
    filters: row.filters,
    aangemaaktOp: row.created_at,
    bijgewerktOp: row.updated_at,
  };
}

async function huidigeUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Je sessie kon niet worden vastgesteld. Log opnieuw in.');
  return data.user.id;
}

// De gegenereerde Database-types lopen één commit achter op deze additieve migratie.
// Houd de cast lokaal; RLS + auth.uid() blijft de autorisatiegrens.
const zoekprofielenTabel = () => (supabase as any).from('bag_zoekprofielen');

export async function haalAccountZoekprofielen(scopeCode: string): Promise<BagZoekprofiel[]> {
  await huidigeUserId();
  const { data, error } = await zoekprofielenTabel()
    .select('id,naam,scope_code,server_filters,filters,created_at,updated_at')
    .eq('scope_code', scopeCode)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('Opgeslagen zoekopdrachten konden niet worden geladen.');
  return ((data ?? []) as ZoekprofielRij[]).map(naarProfiel);
}

export async function maakAccountZoekprofiel(input: Omit<BagZoekprofiel, 'id' | 'aangemaaktOp' | 'bijgewerktOp'>): Promise<BagZoekprofiel> {
  const userId = await huidigeUserId();
  const { data, error } = await zoekprofielenTabel()
    .insert({
      user_id: userId,
      naam: input.naam.trim(),
      scope_code: input.scopeCode,
      server_filters: input.serverFilters,
      filters: input.filters,
    })
    .select('id,naam,scope_code,server_filters,filters,created_at,updated_at')
    .single();
  if (error || !data) throw new Error('Zoekopdracht kon niet worden opgeslagen.');
  return naarProfiel(data as ZoekprofielRij);
}

export async function werkAccountZoekprofielBij(
  id: string,
  input: Pick<BagZoekprofiel, 'naam' | 'scopeCode' | 'serverFilters' | 'filters'>,
): Promise<BagZoekprofiel> {
  await huidigeUserId();
  const { data, error } = await zoekprofielenTabel()
    .update({
      naam: input.naam.trim(),
      scope_code: input.scopeCode,
      server_filters: input.serverFilters,
      filters: input.filters,
    })
    .eq('id', id)
    .select('id,naam,scope_code,server_filters,filters,created_at,updated_at')
    .single();
  if (error || !data) throw new Error('Wijzigingen konden niet worden opgeslagen.');
  return naarProfiel(data as ZoekprofielRij);
}

export async function verwijderAccountZoekprofiel(id: string): Promise<void> {
  await huidigeUserId();
  const { error } = await zoekprofielenTabel().delete().eq('id', id);
  if (error) throw new Error('Zoekopdracht kon niet worden verwijderd.');
}

export async function importeerLokaleZoekprofielen(profielen: BagZoekprofiel[]): Promise<void> {
  if (!profielen.length) return;
  const userId = await huidigeUserId();
  const payload = profielen.map(profiel => ({
    id: profiel.id,
    user_id: userId,
    naam: profiel.naam.trim(),
    scope_code: profiel.scopeCode,
    server_filters: profiel.serverFilters,
    filters: profiel.filters,
    created_at: profiel.aangemaaktOp,
    updated_at: profiel.bijgewerktOp,
  }));
  const { error } = await zoekprofielenTabel().upsert(payload, { onConflict: 'id' });
  if (error) throw new Error('Lokale zoekopdrachten konden niet naar je account worden overgezet.');
}
