import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapDbError } from '@/lib/errors';
import type {
  ParsedSourceImportFile,
  SourceImportColumnMapping,
  SourceImportPreview,
} from '@/lib/vastgoedrekenen/sourceImport';
import type { VastgoedrekenenSourcePackage } from '@/lib/vastgoedrekenen/sourcePackages';
import { toast } from 'sonner';

export type SourceImportRun = {
  id: string;
  bronpakket_id: string;
  bestand_naam: string;
  bestand_type: string;
  bestand_grootte: number;
  bestand_sha256: string;
  werkblad: string | null;
  rij_aantal: number;
  geimporteerd_aantal: number;
  kolom_mapping: Record<string, number>;
  validatie_samenvatting: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

type RpcResult = {
  import_run_id: string;
  imported_count: number;
};

function untypedClient() {
  return supabase as unknown as {
    from: (table: string) => any;
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
}

function normalizeRun(row: Record<string, unknown>): SourceImportRun {
  return {
    id: String(row.id),
    bronpakket_id: String(row.bronpakket_id),
    bestand_naam: String(row.bestand_naam),
    bestand_type: String(row.bestand_type),
    bestand_grootte: Number(row.bestand_grootte),
    bestand_sha256: String(row.bestand_sha256),
    werkblad: row.werkblad ? String(row.werkblad) : null,
    rij_aantal: Number(row.rij_aantal),
    geimporteerd_aantal: Number(row.geimporteerd_aantal),
    kolom_mapping: (row.kolom_mapping ?? {}) as Record<string, number>,
    validatie_samenvatting: (row.validatie_samenvatting ?? {}) as Record<string, unknown>,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
  };
}

export function useSourcePackageImport() {
  const [runs, setRuns] = useState<SourceImportRun[]>([]);
  const [loading, setLoading] = useState(true);

  const refetchRuns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await untypedClient()
      .from('vastgoedrekenen_bronimport_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      toast.error(mapDbError(error, 'Importhistorie kon niet worden geladen. Is de Fase 6D.2-migratie toegepast?'));
      setRuns([]);
    } else {
      setRuns((data ?? []).map((row: Record<string, unknown>) => normalizeRun(row)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refetchRuns(); }, [refetchRuns]);

  const importPreview = useCallback(async (args: {
    pkg: VastgoedrekenenSourcePackage;
    file: ParsedSourceImportFile;
    sheetName: string;
    mapping: SourceImportColumnMapping;
    preview: SourceImportPreview;
  }): Promise<RpcResult | null> => {
    if (args.pkg.status !== 'concept' || args.pkg.system_managed) {
      toast.error('Importeren kan alleen in een regulier conceptbronpakket.');
      return null;
    }
    if (!args.preview.canImport) {
      toast.error('Los eerst alle importfouten en conflicten op.');
      return null;
    }

    const fileMeta = {
      bestand_naam: args.file.fileName,
      bestand_type: args.file.kind,
      bestand_grootte: args.file.fileSize,
      bestand_sha256: args.file.sha256,
      werkblad: args.sheetName,
      validatie_samenvatting: {
        geldig: args.preview.validCount,
        fouten: args.preview.errorCount,
        conflicten: args.preview.conflictCount,
      },
    };

    const { data, error } = await untypedClient().rpc('vastgoedrekenen_import_kengetallen', {
      p_bronpakket_id: args.pkg.id,
      p_bestand: fileMeta,
      p_kolom_mapping: args.mapping,
      p_rows: args.preview.validRows,
    });

    if (error) {
      toast.error(mapDbError(error, 'Bronbestand importeren mislukt. Er is niets gedeeltelijk opgeslagen.'));
      return null;
    }

    const result = data as RpcResult;
    toast.success(`${Number(result.imported_count)} kengetallen geïmporteerd in ${args.pkg.naam}.`);
    await refetchRuns();
    return result;
  }, [refetchRuns]);

  return { runs, loading, refetchRuns, importPreview };
}
