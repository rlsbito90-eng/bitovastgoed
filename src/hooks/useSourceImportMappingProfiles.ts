import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapDbError } from '@/lib/errors';
import {
  SOURCE_IMPORT_MAPPING_PROFILE_SCHEMA_VERSION,
  type SourceImportMappingProfile,
  type SourceImportMappingProfileDraft,
} from '@/lib/vastgoedrekenen/sourceImportMappingProfiles';
import { toast } from 'sonner';

function untypedTable() {
  return (supabase as unknown as { from: (name: string) => any }).from('vastgoedrekenen_bronimport_mapping_profielen');
}

function normalizeProfile(row: Record<string, unknown>): SourceImportMappingProfile {
  return {
    id: String(row.id),
    naam: String(row.naam),
    bron_naam: row.bron_naam ? String(row.bron_naam) : null,
    kolommen: (row.kolommen ?? {}) as SourceImportMappingProfile['kolommen'],
    actief: Boolean(row.actief),
    system_managed: Boolean(row.system_managed),
    schema_version: Number(row.schema_version),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function useSourceImportMappingProfiles() {
  const [profiles, setProfiles] = useState<SourceImportMappingProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await untypedTable()
      .select('*')
      .eq('actief', true)
      .order('bron_naam', { ascending: true, nullsFirst: false })
      .order('naam');
    if (error) {
      toast.error(mapDbError(error, 'Kolommappings konden niet worden geladen. Is de Fase 6D.3-migratie toegepast?'));
      setProfiles([]);
    } else {
      setProfiles((data ?? []).map((row: Record<string, unknown>) => normalizeProfile(row)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const saveProfile = useCallback(async (draft: SourceImportMappingProfileDraft) => {
    const naam = draft.naam.trim();
    if (!naam) {
      toast.error('Geef het mappingprofiel een herkenbare naam.');
      return null;
    }
    if (Object.keys(draft.kolommen).length === 0) {
      toast.error('Koppel eerst kolommen voordat je een mappingprofiel opslaat.');
      return null;
    }

    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await untypedTable()
      .insert({
        naam,
        bron_naam: draft.bron_naam?.trim() || null,
        kolommen: draft.kolommen,
        actief: true,
        system_managed: false,
        schema_version: SOURCE_IMPORT_MAPPING_PROFILE_SCHEMA_VERSION,
        created_by: authData.user?.id ?? null,
      })
      .select('*')
      .single();
    if (error) {
      toast.error(mapDbError(error, 'Mappingprofiel opslaan mislukt. Gebruik een unieke profielnaam.'));
      return null;
    }
    toast.success('Kolommapping opgeslagen als herbruikbaar profiel.');
    await refetch();
    return normalizeProfile(data as Record<string, unknown>);
  }, [refetch]);

  const archiveProfile = useCallback(async (profile: SourceImportMappingProfile) => {
    if (profile.system_managed) {
      toast.error('Een systeembeheerd mappingprofiel kan niet worden gearchiveerd.');
      return false;
    }
    const { error } = await untypedTable()
      .update({ actief: false, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) {
      toast.error(mapDbError(error, 'Mappingprofiel archiveren mislukt.'));
      return false;
    }
    toast.success('Mappingprofiel gearchiveerd. Bestaande importaudit blijft intact.');
    await refetch();
    return true;
  }, [refetch]);

  return { profiles, loading, refetch, saveProfile, archiveProfile };
}
