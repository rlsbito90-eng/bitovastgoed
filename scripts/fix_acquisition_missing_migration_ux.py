from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:180]!r}')
    file.write_text(text.replace(old, new, 1))


# 1. Shared acquisition schema detection and exact user message.
path = 'src/lib/vastgoedrekenen/acquisition.ts'
replace_once(path,
"""import type { Component, SellOffUnit } from './types';
""",
"""import type { Component, SellOffUnit } from './types';

export const ACQUISITION_STRUCTURE_MIGRATION = '20260725153000_vastgoedrekenen_verkrijgingsstructuur.sql';

export type AcquisitionStructureStatus = 'available' | 'migration_required' | 'error';

type DbLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined;

export function isAcquisitionStructureMigrationMissing(error: DbLikeError): boolean {
  const code = String(error?.code ?? '');
  if (code === '42P01' || code === 'PGRST205') return true;
  const raw = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const namesAcquisitionTable = raw.includes('calculation_acquisition_components')
    || raw.includes('calculation_acquisition_unit_links');
  const missingRelation = raw.includes('could not find the table')
    || raw.includes('schema cache')
    || raw.includes('does not exist')
    || raw.includes('undefined table');
  return namesAcquisitionTable && missingRelation;
}

export function acquisitionStructureStatusMessage(
  status: AcquisitionStructureStatus,
  errorMessage?: string | null,
): string | null {
  if (status === 'available') return null;
  if (status === 'migration_required') {
    return `De interface is bijgewerkt, maar de benodigde databasetabellen ontbreken. Voer Supabase-migratie ${ACQUISITION_STRUCTURE_MIGRATION} uit en ververs daarna deze pagina.`;
  }
  return errorMessage
    || 'De verkrijgingsstructuur kon niet uit de database worden geladen. Controleer de databaseverbinding en probeer het opnieuw.';
}
""")

# 2. Generic PostgREST missing-table translation.
path = 'src/lib/errors.ts'
replace_once(path,
"""  '42P01': 'Onderdeel niet beschikbaar',
  'PGRST301': 'Je hebt geen rechten om deze wijziging op te slaan',
""",
"""  '42P01': 'Onderdeel niet beschikbaar',
  'PGRST205': 'Databaseonderdeel ontbreekt of staat nog niet in de schema-cache',
  'PGRST301': 'Je hebt geen rechten om deze wijziging op te slaan',
""")
replace_once(path,
"""  if (msg.includes('invalid input')) return CODE_BASE['22P02'];
  return undefined;
""",
"""  if (msg.includes('invalid input')) return CODE_BASE['22P02'];
  if (msg.includes('could not find the table') || msg.includes('schema cache') || msg.includes('does not exist')) return CODE_BASE['42P01'];
  return undefined;
""")

# 3. Hook: expose availability and stop CRUD before a known missing migration.
path = 'src/hooks/useVastgoedrekenen.tsx'
replace_once(path,
"""import type { AcquisitionComponent, AcquisitionUnitLink } from '@/lib/vastgoedrekenen/acquisition';
""",
"""import {
  acquisitionStructureStatusMessage,
  isAcquisitionStructureMigrationMissing,
  type AcquisitionComponent,
  type AcquisitionStructureStatus,
  type AcquisitionUnitLink,
} from '@/lib/vastgoedrekenen/acquisition';
""")
replace_once(path,
"""  const [acquisitionComponents, setAcquisitionComponents] = useState<AcquisitionComponent[]>([]);
  const [acquisitionUnitLinks, setAcquisitionUnitLinks] = useState<AcquisitionUnitLink[]>([]);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);
""",
"""  const [acquisitionComponents, setAcquisitionComponents] = useState<AcquisitionComponent[]>([]);
  const [acquisitionUnitLinks, setAcquisitionUnitLinks] = useState<AcquisitionUnitLink[]>([]);
  const [acquisitionStructureStatus, setAcquisitionStructureStatus] = useState<AcquisitionStructureStatus>('available');
  const [acquisitionStructureError, setAcquisitionStructureError] = useState<string | null>(null);
  const [costs, setCosts] = useState<ScenarioCost[]>([]);
""")
replace_once(path,
"""    setComponents((c.data ?? []) as Component[]);
    // 42P01 = migratie nog niet toegepast. In dat geval blijft het legacy OVB-pad actief.
    setAcquisitionComponents(acq.error ? [] : (acq.data ?? []) as AcquisitionComponent[]);
    setAcquisitionUnitLinks(acqLinks.error ? [] : (acqLinks.data ?? []) as AcquisitionUnitLink[]);
    setCosts((k.data ?? []) as ScenarioCost[]);
""",
"""    setComponents((c.data ?? []) as Component[]);
    const acquisitionError = acq.error ?? acqLinks.error;
    if (!acquisitionError) {
      setAcquisitionComponents((acq.data ?? []) as AcquisitionComponent[]);
      setAcquisitionUnitLinks((acqLinks.data ?? []) as AcquisitionUnitLink[]);
      setAcquisitionStructureStatus('available');
      setAcquisitionStructureError(null);
    } else {
      setAcquisitionComponents([]);
      setAcquisitionUnitLinks([]);
      if (isAcquisitionStructureMigrationMissing(acquisitionError)) {
        setAcquisitionStructureStatus('migration_required');
        setAcquisitionStructureError(null);
      } else {
        setAcquisitionStructureStatus('error');
        setAcquisitionStructureError(describeDbError(acquisitionError, {
          module: 'Vastgoedrekenen',
          section: 'Verkrijgingsstructuur',
          fallback: 'Verkrijgingsstructuur laden mislukt',
        }));
      }
    }
    setCosts((k.data ?? []) as ScenarioCost[]);
""")
replace_once(path,
"""  // --- Verkrijgingsstructuur (feitelijke situatie bij aankoop) ---
  const createAcquisitionComponent = useCallback(async (patch: Partial<AcquisitionComponent> = {}) => {
""",
"""  // --- Verkrijgingsstructuur (feitelijke situatie bij aankoop) ---
  const recordAcquisitionError = useCallback((error: unknown, fallback: string): string => {
    if (isAcquisitionStructureMigrationMissing(error as { code?: string; message?: string; details?: string; hint?: string })) {
      setAcquisitionStructureStatus('migration_required');
      setAcquisitionStructureError(null);
      return acquisitionStructureStatusMessage('migration_required') as string;
    }
    const message = describeDbError(error as { code?: string; message?: string; details?: string; hint?: string }, {
      module: 'Vastgoedrekenen',
      section: 'Verkrijgingsstructuur',
      fallback,
    });
    setAcquisitionStructureStatus('error');
    setAcquisitionStructureError(message);
    return message;
  }, []);

  const createAcquisitionComponent = useCallback(async (patch: Partial<AcquisitionComponent> = {}) => {
""")
replace_once(path,
"""    if (!scenarioId) return null;
    const untyped = supabase as unknown as { from: (table: string) => any };
""",
"""    if (!scenarioId) return null;
    if (acquisitionStructureStatus !== 'available') {
      toast.error(acquisitionStructureStatusMessage(acquisitionStructureStatus, acquisitionStructureError) as string);
      return null;
    }
    const untyped = supabase as unknown as { from: (table: string) => any };
""")
replace_once(path,
"""    if (error) {
      toast.error(error.code === '42P01'
        ? 'Verkrijgingsstructuur is nog niet beschikbaar. Pas eerst de nieuwe Supabase-migratie toe.'
        : mapDbError(error, 'Verkrijgingscomponent aanmaken mislukt'));
      return null;
    }
    await fetchAll();
    return data as AcquisitionComponent;
  }, [scenarioId, acquisitionComponents.length, fetchAll]);
""",
"""    if (error) {
      toast.error(recordAcquisitionError(error, 'Verkrijgingscomponent aanmaken mislukt'));
      return null;
    }
    await fetchAll();
    return data as AcquisitionComponent;
  }, [scenarioId, acquisitionComponents.length, acquisitionStructureStatus, acquisitionStructureError, fetchAll, recordAcquisitionError]);
""")
replace_once(path,
"""    if (error) toast.error(mapDbError(error, 'Verkrijgingscomponent wijzigen mislukt'));
    else await fetchAll();
  }, [fetchAll]);
""",
"""    if (error) toast.error(recordAcquisitionError(error, 'Verkrijgingscomponent wijzigen mislukt'));
    else await fetchAll();
  }, [fetchAll, recordAcquisitionError]);
""")
replace_once(path,
"""    if (error) toast.error(mapDbError(error, 'Verkrijgingscomponent verwijderen mislukt'));
    else await fetchAll();
  }, [fetchAll]);
""",
"""    if (error) toast.error(recordAcquisitionError(error, 'Verkrijgingscomponent verwijderen mislukt'));
    else await fetchAll();
  }, [fetchAll, recordAcquisitionError]);
""")
replace_once(path,
"""    if (deleteError) {
      toast.error(mapDbError(deleteError, 'Koppelingen wijzigen mislukt'));
      return;
    }
""",
"""    if (deleteError) {
      toast.error(recordAcquisitionError(deleteError, 'Koppelingen wijzigen mislukt'));
      return;
    }
""")
replace_once(path,
"""      if (insertError) {
        toast.error(mapDbError(insertError, 'Koppelingen opslaan mislukt'));
        await fetchAll();
        return;
      }
""",
"""      if (insertError) {
        toast.error(recordAcquisitionError(insertError, 'Koppelingen opslaan mislukt'));
        await fetchAll();
        return;
      }
""")
replace_once(path,
"""  }, [scenarioId, fetchAll]);

  // --- Componentstrategie (sell_off_units) ---
""",
"""  }, [scenarioId, fetchAll, recordAcquisitionError]);

  // --- Componentstrategie (sell_off_units) ---
""")
replace_once(path,
"""    components, acquisitionComponents, acquisitionUnitLinks, costs, wwsUnits, sellOffUnits, risks, output, loading,
    refetch: fetchAll, upsertOutput,
""",
"""    components, acquisitionComponents, acquisitionUnitLinks, acquisitionStructureStatus,
    acquisitionStructureMessage: acquisitionStructureStatusMessage(acquisitionStructureStatus, acquisitionStructureError),
    costs, wwsUnits, sellOffUnits, risks, output, loading,
    refetch: fetchAll, upsertOutput,
""")

# 4. Scenario editor passes status/message to the component.
path = 'src/components/vastgoedrekenen/ScenarioEditor.tsx'
replace_once(path,
"""    components, acquisitionComponents, acquisitionUnitLinks, costs, wwsUnits, sellOffUnits,
    loading: childrenLoading, refetch, upsertOutput,
""",
"""    components, acquisitionComponents, acquisitionUnitLinks, acquisitionStructureStatus, acquisitionStructureMessage,
    costs, wwsUnits, sellOffUnits,
    loading: childrenLoading, refetch, upsertOutput,
""")
replace_once(path,
"""                     purchasePrice={Number(s.purchase_price ?? 0)}
                     onCreate={createAcquisitionComponent}
""",
"""                     purchasePrice={Number(s.purchase_price ?? 0)}
                     availability={acquisitionStructureStatus}
                     unavailableMessage={acquisitionStructureMessage}
                     onCreate={createAcquisitionComponent}
""")

# 5. UI: disable button and show exact migration guidance.
path = 'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx'
replace_once(path,
"""import type { AcquisitionComponent, AcquisitionUnitLink } from '@/lib/vastgoedrekenen/acquisition';
""",
"""import type { AcquisitionComponent, AcquisitionStructureStatus, AcquisitionUnitLink } from '@/lib/vastgoedrekenen/acquisition';
""")
replace_once(path,
"""  purchasePrice: number;
  onCreate: (patch?: Partial<AcquisitionComponent>) => Promise<AcquisitionComponent | null>;
""",
"""  purchasePrice: number;
  availability: AcquisitionStructureStatus;
  unavailableMessage: string | null;
  onCreate: (patch?: Partial<AcquisitionComponent>) => Promise<AcquisitionComponent | null>;
""")
replace_once(path,
"""  ovbPerComponent,
  purchasePrice,
  onCreate,
""",
"""  ovbPerComponent,
  purchasePrice,
  availability,
  unavailableMessage,
  onCreate,
""")
replace_once(path,
"""  const createComponent = async () => {
    const created = await onCreate({
""",
"""  const createComponent = async () => {
    if (availability !== 'available') return;
    const created = await onCreate({
""")
replace_once(path,
"""        <Button size="sm" variant="outline" onClick={() => void createComponent()} className="shrink-0">
          <Plus className="mr-1 h-3.5 w-3.5" /> Verkrijgingscomponent
        </Button>
      </div>

      {components.length === 0 ? (
""",
"""        <Button
          size="sm"
          variant="outline"
          onClick={() => void createComponent()}
          className="shrink-0"
          disabled={availability !== 'available'}
          title={availability !== 'available' ? unavailableMessage ?? 'Verkrijgingsstructuur niet beschikbaar' : undefined}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Verkrijgingscomponent
        </Button>
      </div>

      {availability !== 'available' && (
        <div className={`flex gap-2 rounded-md border px-3 py-3 text-xs ${
          availability === 'migration_required'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
            : 'border-destructive/40 bg-destructive/5 text-destructive'
        }`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">
              {availability === 'migration_required' ? 'Database-migratie vereist' : 'Verkrijgingsstructuur niet beschikbaar'}
            </p>
            <p className="leading-relaxed">{unavailableMessage}</p>
            <p className="text-[11px] opacity-80">De bestaande projectcomponenten blijven tijdelijk het OVB-terugvalpad; er wordt niets automatisch gewijzigd.</p>
          </div>
        </div>
      )}

      {availability !== 'available' ? null : components.length === 0 ? (
""")

# 6. Tests.
Path('src/test/vastgoedrekenen/acquisitionMigrationError.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  ACQUISITION_STRUCTURE_MIGRATION,
  acquisitionStructureStatusMessage,
  isAcquisitionStructureMigrationMissing,
} from '@/lib/vastgoedrekenen/acquisition';

describe('verkrijgingsstructuur databasebeschikbaarheid', () => {
  it('herkent PostgREST PGRST205 als ontbrekende migratie', () => {
    expect(isAcquisitionStructureMigrationMissing({
      code: 'PGRST205',
      message: "Could not find the table 'public.calculation_acquisition_components' in the schema cache",
    })).toBe(true);
  });

  it('herkent PostgreSQL undefined-table en schema-cachetekst', () => {
    expect(isAcquisitionStructureMigrationMissing({ code: '42P01' })).toBe(true);
    expect(isAcquisitionStructureMigrationMissing({
      message: 'relation public.calculation_acquisition_unit_links does not exist',
    })).toBe(true);
  });

  it('presenteert het exacte migratiebestand en classificeert andere fouten niet als migratie', () => {
    expect(acquisitionStructureStatusMessage('migration_required')).toContain(ACQUISITION_STRUCTURE_MIGRATION);
    expect(isAcquisitionStructureMigrationMissing({ code: '42501', message: 'permission denied' })).toBe(false);
  });
});
""")

Path('src/test/ui/acquisitionMigrationUx.test.ts').write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tableSource = readFileSync(resolve(process.cwd(), 'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx'), 'utf8');
const hookSource = readFileSync(resolve(process.cwd(), 'src/hooks/useVastgoedrekenen.tsx'), 'utf8');

describe('verkrijgingsstructuur migratie-UX', () => {
  it('blokkeert toevoegen en toont een gerichte melding zolang de migratie ontbreekt', () => {
    expect(tableSource).toContain("disabled={availability !== 'available'}");
    expect(tableSource).toContain('Database-migratie vereist');
    expect(tableSource).toContain('unavailableMessage');
  });

  it('vangt zowel laad- als schrijffouten af via dezelfde migratiedetectie', () => {
    expect(hookSource).toContain('isAcquisitionStructureMigrationMissing(acquisitionError)');
    expect(hookSource).toContain('recordAcquisitionError');
    expect(hookSource).toContain('acquisitionStructureStatus');
  });
});
""")
