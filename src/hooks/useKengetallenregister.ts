import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  buildSnapshotPayload,
  type KengetalBand,
  type KengetalDraft,
  type ScenarioKengetalSnapshot,
  type VastgoedrekenenKengetal,
} from '@/lib/vastgoedrekenen/kengetallen';
import { mapDbError } from '@/lib/errors';
import type { SourcePackageStatus } from '@/lib/vastgoedrekenen/sourcePackages';

// De gegenereerde Supabase-types worden pas na toepassing van de migratie vernieuwd.
// Runtime gebruikt de letterlijke nieuwe tabelnamen; de casts voorkomen dat deze
// feature afhankelijk wordt van een voortijdige handmatige wijziging in generated types.
function registerTable() {
  return supabase.from('vastgoedrekenen_kengetallen' as 'calculation_scenarios');
}

function untypedTable(table: string) {
  return (supabase as unknown as { from: (name: string) => any }).from(table);
}

function snapshotTable() {
  return untypedTable('scenario_kengetal_snapshots');
}

export type RegisterKengetal = VastgoedrekenenKengetal & {
  bronpakket_id: string | null;
  bronpakket_naam: string | null;
  bronpakket_status: SourcePackageStatus | null;
  bronpakket_locked: boolean;
};

type PackageSummary = {
  id: string;
  naam: string;
  status: SourcePackageStatus;
};

function normalizeKengetal(row: unknown, packages = new Map<string, PackageSummary>()): RegisterKengetal {
  const item = row as VastgoedrekenenKengetal & { bronpakket_id?: string | null };
  const bronpakketId = item.bronpakket_id ?? null;
  const sourcePackage = bronpakketId ? packages.get(bronpakketId) : null;
  return {
    ...item,
    minimum_waarde: Number(item.minimum_waarde),
    basis_waarde: Number(item.basis_waarde),
    maximum_waarde: Number(item.maximum_waarde),
    versie: Number(item.versie),
    toepassingsgebied: item.toepassingsgebied ?? [],
    regio: item.regio ?? [],
    projectfase: item.projectfase ?? [],
    risicoklasse: item.risicoklasse ?? [],
    bronpakket_id: bronpakketId,
    bronpakket_naam: sourcePackage?.naam ?? null,
    bronpakket_status: sourcePackage?.status ?? null,
    bronpakket_locked: sourcePackage?.status === 'goedgekeurd',
  };
}

function normalizeSnapshot(row: unknown): ScenarioKengetalSnapshot {
  const item = row as ScenarioKengetalSnapshot;
  return {
    ...item,
    gekozen_waarde: Number(item.gekozen_waarde),
    minimum_waarde: Number(item.minimum_waarde),
    basis_waarde: Number(item.basis_waarde),
    maximum_waarde: Number(item.maximum_waarde),
    register_versie: Number(item.register_versie),
    toepassingsgebied: item.toepassingsgebied ?? [],
    regio: item.regio ?? [],
    projectfase: item.projectfase ?? [],
    risicoklasse: item.risicoklasse ?? [],
  };
}

/**
 * Kopieert de vaste bronmomentopnamen mee naar een gedupliceerd scenario.
 * Bij een fout wordt het nieuwe scenario verwijderd; alle al gekopieerde children
 * verdwijnen dan via de bestaande cascade, zodat geen halve kopie achterblijft.
 */
export async function cloneScenarioKengetalSnapshots(sourceScenarioId: string, targetScenarioId: string): Promise<boolean> {
  const { data, error } = await snapshotTable()
    .select('*')
    .eq('scenario_id', sourceScenarioId);
  if (error) {
    await supabase.from('calculation_scenarios').delete().eq('id', targetScenarioId);
    toast.error(mapDbError(error, 'Scenario dupliceren afgebroken: kengetal-snapshots konden niet worden geladen.'));
    return false;
  }

  const rows = data ?? [];
  if (rows.length === 0) return true;

  const now = new Date().toISOString();
  const payloads = rows.map((row: Record<string, unknown>) => {
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...snapshot } = row;
    return {
      ...snapshot,
      scenario_id: targetScenarioId,
      created_at: now,
      updated_at: now,
    };
  });

  const { error: insertError } = await snapshotTable().insert(payloads as never);
  if (insertError) {
    const { error: rollbackError } = await supabase.from('calculation_scenarios').delete().eq('id', targetScenarioId);
    if (rollbackError) {
      toast.error('Scenario is onvolledig gedupliceerd en kon niet automatisch worden teruggedraaid. Controleer de nieuwe kopie.');
    } else {
      toast.error(mapDbError(insertError, 'Scenario dupliceren afgebroken: kengetal-snapshots konden niet worden gekopieerd.'));
    }
    return false;
  }
  return true;
}

export function useKengetallenregister() {
  const [entries, setEntries] = useState<RegisterKengetal[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [registerResult, packageResult] = await Promise.all([
      registerTable().select('*'),
      untypedTable('vastgoedrekenen_bronpakketten').select('id, naam, status'),
    ]);

    if (registerResult.error) {
      toast.error(mapDbError(registerResult.error, 'Kengetallenregister kon niet worden geladen. Is de migratie al toegepast?'));
      setEntries([]);
    } else {
      const packageMap = new Map<string, PackageSummary>();
      if (!packageResult.error) {
        (packageResult.data ?? []).forEach((row: Record<string, unknown>) => {
          const item: PackageSummary = {
            id: String(row.id),
            naam: String(row.naam),
            status: row.status as SourcePackageStatus,
          };
          packageMap.set(item.id, item);
        });
      }
      const next = (registerResult.data ?? [])
        .map((row) => normalizeKengetal(row, packageMap))
        .sort((a, b) => a.categorie.localeCompare(b.categorie, 'nl-NL') || a.naam.localeCompare(b.naam, 'nl-NL'));
      setEntries(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const save = useCallback(async (draft: KengetalDraft, id?: string | null) => {
    if (!(draft.minimum_waarde <= draft.basis_waarde && draft.basis_waarde <= draft.maximum_waarde)) {
      toast.error('Bandbreedte ongeldig: minimum ≤ basis ≤ maximum is verplicht.');
      return null;
    }
    if (!draft.naam.trim() || !draft.code.trim() || !draft.bron_naam.trim()) {
      toast.error('Naam, code en bron zijn verplicht.');
      return null;
    }

    const now = new Date().toISOString();
    if (id) {
      const current = entries.find((entry) => entry.id === id);
      if (current?.bronpakket_locked) {
        toast.error('Dit kengetal behoort tot een goedgekeurd bronpakket en is vergrendeld. Archiveer het pakket voor een nieuwe bronversie.');
        return null;
      }
      const payload = {
        ...draft,
        code: draft.code.trim(),
        naam: draft.naam.trim(),
        bron_naam: draft.bron_naam.trim(),
        bron_referentie: draft.bron_referentie?.trim() || null,
        toelichting: draft.toelichting?.trim() || null,
        versie: Number(current?.versie ?? 0) + 1,
        updated_at: now,
      };
      const { data, error } = await registerTable()
        .update(payload as never)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        toast.error(mapDbError(error, 'Kengetal wijzigen mislukt'));
        return null;
      }
      toast.success('Kengetal bijgewerkt. Bestaande scenario-snapshots zijn niet gewijzigd.');
      await refetch();
      return normalizeKengetal(data);
    }

    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      ...draft,
      code: draft.code.trim(),
      naam: draft.naam.trim(),
      bron_naam: draft.bron_naam.trim(),
      bron_referentie: draft.bron_referentie?.trim() || null,
      toelichting: draft.toelichting?.trim() || null,
      versie: 1,
      created_by: userData.user?.id ?? null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await registerTable()
      .insert(payload as never)
      .select('*')
      .single();
    if (error) {
      toast.error(mapDbError(error, 'Kengetal aanmaken mislukt'));
      return null;
    }
    toast.success('Kengetal toegevoegd');
    await refetch();
    return normalizeKengetal(data);
  }, [entries, refetch]);

  const setActive = useCallback(async (entry: RegisterKengetal, active: boolean) => {
    if (entry.bronpakket_locked) {
      toast.error('Dit kengetal behoort tot een goedgekeurd bronpakket en is vergrendeld.');
      return;
    }
    const { error } = await registerTable()
      .update({
        actief: active,
        versie: Number(entry.versie) + 1,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', entry.id);
    if (error) toast.error(mapDbError(error, 'Status kengetal wijzigen mislukt'));
    else {
      toast.success(active ? 'Kengetal geactiveerd' : 'Kengetal gearchiveerd');
      await refetch();
    }
  }, [refetch]);

  return { entries, loading, refetch, save, setActive };
}

export function useScenarioKengetalSnapshots(scenarioId: string) {
  const [snapshots, setSnapshots] = useState<ScenarioKengetalSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await snapshotTable()
      .select('*')
      .eq('scenario_id', scenarioId);
    if (error) {
      toast.error(mapDbError(error, 'Scenario-snapshots konden niet worden geladen.'));
      setSnapshots([]);
    } else {
      setSnapshots((data ?? [])
        .map(normalizeSnapshot)
        .sort((a: ScenarioKengetalSnapshot, b: ScenarioKengetalSnapshot) => b.snapshot_op.localeCompare(a.snapshot_op)));
    }
    setLoading(false);
  }, [scenarioId]);

  useEffect(() => { void refetch(); }, [refetch]);

  const apply = useCallback(async (args: {
    kengetal: VastgoedrekenenKengetal;
    band: KengetalBand;
    manualValue?: number | null;
    overrideReason?: string | null;
  }) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = buildSnapshotPayload({
        scenarioId,
        ...args,
        userId: userData.user?.id ?? null,
      });
      const { data, error } = await snapshotTable()
        .upsert({
          ...payload,
          updated_at: new Date().toISOString(),
        } as never, { onConflict: 'scenario_id,kengetal_code' })
        .select('*')
        .single();
      if (error) {
        toast.error(mapDbError(error, 'Kengetal toepassen op scenario mislukt'));
        return null;
      }
      await refetch();
      return normalizeSnapshot(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kengetal toepassen mislukt');
      return null;
    }
  }, [scenarioId, refetch]);

  const remove = useCallback(async (id: string) => {
    const { error } = await snapshotTable().delete().eq('id', id);
    if (error) toast.error(mapDbError(error, 'Scenario-snapshot verwijderen mislukt'));
    else {
      toast.success('Kengetal-snapshot verwijderd');
      await refetch();
    }
  }, [refetch]);

  return { snapshots, loading, refetch, apply, remove };
}
