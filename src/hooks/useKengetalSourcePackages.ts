import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapDbError } from '@/lib/errors';
import {
  assessSourcePackage,
  type SourcePackageDraft,
  type SourcePackageEntry,
  type VastgoedrekenenSourcePackage,
} from '@/lib/vastgoedrekenen/sourcePackages';
import { toast } from 'sonner';

function untypedTable(table: string) {
  return (supabase as unknown as { from: (name: string) => any }).from(table);
}

function normalizePackage(row: Record<string, unknown>): VastgoedrekenenSourcePackage {
  return {
    ...(row as unknown as VastgoedrekenenSourcePackage),
    versie: Number(row.versie),
    location_keys: Array.isArray(row.location_keys) ? row.location_keys as string[] : [],
    system_managed: Boolean(row.system_managed),
  };
}

function normalizeEntry(row: Record<string, unknown>): SourcePackageEntry {
  return {
    id: String(row.id),
    code: String(row.code),
    naam: String(row.naam),
    actief: Boolean(row.actief),
    bronpakket_id: row.bronpakket_id ? String(row.bronpakket_id) : null,
    bron_type: String(row.bron_type),
    bron_naam: String(row.bron_naam),
    bron_peildatum: String(row.bron_peildatum),
    geldig_vanaf: row.geldig_vanaf ? String(row.geldig_vanaf) : null,
    vervaldatum: String(row.vervaldatum),
    unit_code: row.unit_code ? String(row.unit_code) : null,
    vat_treatment_code: row.vat_treatment_code ? String(row.vat_treatment_code) : null,
  };
}

export function useKengetalSourcePackages() {
  const [packages, setPackages] = useState<VastgoedrekenenSourcePackage[]>([]);
  const [entries, setEntries] = useState<SourcePackageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [packageResult, entryResult] = await Promise.all([
      untypedTable('vastgoedrekenen_bronpakketten').select('*').order('naam').order('versie', { ascending: false }),
      untypedTable('vastgoedrekenen_kengetallen')
        .select('id, code, naam, actief, bronpakket_id, bron_type, bron_naam, bron_peildatum, geldig_vanaf, vervaldatum, unit_code, vat_treatment_code')
        .order('naam'),
    ]);

    if (packageResult.error) {
      toast.error(mapDbError(packageResult.error, 'Bronpakketten konden niet worden geladen. Is de migratie toegepast?'));
      setPackages([]);
    } else {
      setPackages((packageResult.data ?? []).map((row: Record<string, unknown>) => normalizePackage(row)));
    }

    if (entryResult.error) {
      toast.error(mapDbError(entryResult.error, 'Kengetallen voor bronpakketten konden niet worden geladen.'));
      setEntries([]);
    } else {
      setEntries((entryResult.data ?? []).map((row: Record<string, unknown>) => normalizeEntry(row)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const entriesByPackage = useMemo(() => {
    const result = new Map<string, SourcePackageEntry[]>();
    entries.forEach((entry) => {
      if (!entry.bronpakket_id) return;
      const current = result.get(entry.bronpakket_id) ?? [];
      current.push(entry);
      result.set(entry.bronpakket_id, current);
    });
    return result;
  }, [entries]);

  const saveDraft = useCallback(async (draft: SourcePackageDraft, id?: string | null) => {
    if (!draft.code.trim() || !draft.naam.trim() || !draft.bron_naam.trim()) {
      toast.error('Pakketcode, naam en bronnaam zijn verplicht.');
      return null;
    }

    const duplicate = packages.find((item) => item.code === draft.code.trim() && item.versie === Number(draft.versie) && item.id !== id);
    if (duplicate) {
      toast.error('Deze combinatie van pakketcode en versie bestaat al.');
      return null;
    }

    const now = new Date().toISOString();
    const payload = {
      ...draft,
      code: draft.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
      naam: draft.naam.trim(),
      bron_naam: draft.bron_naam.trim(),
      bron_referentie: draft.bron_referentie?.trim() || null,
      bron_versie: draft.bron_versie?.trim() || null,
      geografische_scope: draft.geografische_scope?.trim() || null,
      meetgrondslag: draft.meetgrondslag?.trim() || null,
      scope_inclusief: draft.scope_inclusief?.trim() || null,
      scope_exclusief: draft.scope_exclusief?.trim() || null,
      indexeringsmethode: draft.indexeringsmethode?.trim() || null,
      toelichting: draft.toelichting?.trim() || null,
      valuta_code: draft.valuta_code.trim().toUpperCase(),
      status: 'concept',
      updated_at: now,
    };

    if (id) {
      const current = packages.find((item) => item.id === id);
      if (!current || current.status !== 'concept' || current.system_managed) {
        toast.error('Alleen een niet-systeembeheerd conceptpakket kan worden gewijzigd.');
        return null;
      }
      const { data, error } = await untypedTable('vastgoedrekenen_bronpakketten')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        toast.error(mapDbError(error, 'Bronpakket bijwerken mislukt.'));
        return null;
      }
      toast.success('Conceptbronpakket bijgewerkt.');
      await refetch();
      return normalizePackage(data as Record<string, unknown>);
    }

    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await untypedTable('vastgoedrekenen_bronpakketten')
      .insert({ ...payload, created_by: authData.user?.id ?? null, created_at: now })
      .select('*')
      .single();
    if (error) {
      toast.error(mapDbError(error, 'Bronpakket aanmaken mislukt.'));
      return null;
    }
    toast.success('Conceptbronpakket aangemaakt.');
    await refetch();
    return normalizePackage(data as Record<string, unknown>);
  }, [packages, refetch]);

  const setEntryPackage = useCallback(async (entryId: string, packageId: string | null) => {
    if (packageId) {
      const target = packages.find((item) => item.id === packageId);
      if (!target || target.status !== 'concept' || target.system_managed) {
        toast.error('Kengetallen kunnen alleen aan een bewerkbaar conceptpakket worden gekoppeld.');
        return false;
      }
    }

    const { error } = await untypedTable('vastgoedrekenen_kengetallen')
      .update({ bronpakket_id: packageId, updated_at: new Date().toISOString() })
      .eq('id', entryId);
    if (error) {
      toast.error(mapDbError(error, packageId ? 'Kengetal koppelen mislukt.' : 'Kengetal ontkoppelen mislukt.'));
      return false;
    }
    await refetch();
    return true;
  }, [packages, refetch]);

  const approve = useCallback(async (pkg: VastgoedrekenenSourcePackage) => {
    const assessment = assessSourcePackage(pkg, entriesByPackage.get(pkg.id) ?? []);
    if (!assessment.canApprove) {
      toast.error(assessment.issues[0]?.message ?? 'Dit bronpakket is nog niet gereed voor goedkeuring.');
      return false;
    }
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await untypedTable('vastgoedrekenen_bronpakketten')
      .update({
        status: 'goedgekeurd',
        goedgekeurd_door: authData.user?.id ?? null,
        goedgekeurd_op: new Date().toISOString(),
      })
      .eq('id', pkg.id);
    if (error) {
      toast.error(mapDbError(error, 'Bronpakket goedkeuren mislukt.'));
      return false;
    }
    toast.success('Bronpakket goedgekeurd. De gekoppelde kengetallen zijn nu vergrendeld.');
    await refetch();
    return true;
  }, [entriesByPackage, refetch]);

  const archive = useCallback(async (pkg: VastgoedrekenenSourcePackage) => {
    if (pkg.system_managed) {
      toast.error('Een systeembeheerd bronpakket kan niet via de gebruikersinterface worden gearchiveerd.');
      return false;
    }
    const { error } = await untypedTable('vastgoedrekenen_bronpakketten')
      .update({ status: 'gearchiveerd' })
      .eq('id', pkg.id);
    if (error) {
      toast.error(mapDbError(error, 'Bronpakket archiveren mislukt.'));
      return false;
    }
    toast.success('Bronpakket gearchiveerd. Gekoppelde regels kunnen nu worden herzien of ontkoppeld.');
    await refetch();
    return true;
  }, [refetch]);

  return {
    packages,
    entries,
    entriesByPackage,
    loading,
    refetch,
    saveDraft,
    setEntryPackage,
    approve,
    archive,
  };
}
