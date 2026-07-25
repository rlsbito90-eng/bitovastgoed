from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:140]!r}')
    file.write_text(text.replace(old, new, 1))


# Separate descriptive acquisition types from future project component types.
acquisition_path = Path('src/lib/vastgoedrekenen/acquisition.ts')
acquisition = acquisition_path.read_text()
acquisition = acquisition.replace(
    "import type { Component, SellOffUnit } from './types';\n",
    "import type { Component, SellOffUnit } from './types';\n\n"
    "export const ACQUISITION_COMPONENT_TYPE_LABELS = {\n"
    "  woning: 'Woning',\n"
    "  appartement: 'Appartement',\n"
    "  studio: 'Studio',\n"
    "  kamer: 'Kamer',\n"
    "  winkelruimte: 'Winkelruimte',\n"
    "  kantoorruimte: 'Kantoorruimte',\n"
    "  bedrijfsruimte: 'Bedrijfsruimte',\n"
    "  bedrijfsunit: 'Bedrijfsunit',\n"
    "  opslagruimte: 'Opslagruimte',\n"
    "  kelder: 'Kelder',\n"
    "  parkeerplaats: 'Parkeerplaats',\n"
    "  garagebox: 'Garagebox',\n"
    "  berging: 'Berging',\n"
    "  horeca: 'Horeca',\n"
    "  maatschappelijk: 'Maatschappelijk',\n"
    "  ontwikkelgrond: 'Ontwikkelgrond',\n"
    "  woon_winkelpand: 'Woon-winkelpand',\n"
    "  woon_kantoorpand: 'Woon-kantoorpand',\n"
    "  woon_bedrijfspand: 'Woon-bedrijfspand',\n"
    "  winkel_kantoorpand: 'Winkel-kantoorpand',\n"
    "  mixed_use: 'Mixed-use / gecombineerd gebruik',\n"
    "  mixed_use_overig: 'Ander gecombineerd gebruik',\n"
    "  overig: 'Overig',\n"
    "} as const;\n\n"
    "export type AcquisitionComponentType = keyof typeof ACQUISITION_COMPONENT_TYPE_LABELS;\n",
    1,
)
acquisition = acquisition.replace(
    "  component_type: Component['component_type'];",
    "  component_type: AcquisitionComponentType;",
    1,
)
acquisition_path.write_text(acquisition)

# Use acquisition-specific labels in the drawer/table only.
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    "import { VR_COMPONENT_LABELS, VR_OVB_CLASSIFICATION_LABELS } from '@/lib/vastgoedrekenen/defaults';\n"
    "import type { ComputedOutputs, SellOffUnit } from '@/lib/vastgoedrekenen/types';\n"
    "import type { AcquisitionComponent, AcquisitionStructureStatus, AcquisitionUnitLink } from '@/lib/vastgoedrekenen/acquisition';",
    "import { VR_OVB_CLASSIFICATION_LABELS } from '@/lib/vastgoedrekenen/defaults';\n"
    "import type { ComputedOutputs, SellOffUnit } from '@/lib/vastgoedrekenen/types';\n"
    "import { ACQUISITION_COMPONENT_TYPE_LABELS, type AcquisitionComponent, type AcquisitionStructureStatus, type AcquisitionUnitLink } from '@/lib/vastgoedrekenen/acquisition';",
)
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    "<TableCell>{VR_COMPONENT_LABELS[component.component_type] ?? component.component_type}</TableCell>",
    "<TableCell>{ACQUISITION_COMPONENT_TYPE_LABELS[component.component_type] ?? component.component_type}</TableCell>",
)
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    "<SelectContent>{Object.entries(VR_COMPONENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>",
    "<SelectContent>{Object.entries(ACQUISITION_COMPONENT_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>",
)

# Keep the original migration correct for clean environments.
migration_path = Path('supabase/migrations/20260725153000_vastgoedrekenen_verkrijgingsstructuur.sql')
migration = migration_path.read_text()
migration = migration.replace(
    "      'horeca', 'maatschappelijk', 'ontwikkelgrond', 'overig'",
    "      'horeca', 'maatschappelijk', 'ontwikkelgrond',\n"
    "      'woon_winkelpand', 'woon_kantoorpand', 'woon_bedrijfspand',\n"
    "      'winkel_kantoorpand', 'mixed_use', 'mixed_use_overig', 'overig'",
    1,
)
migration_path.write_text(migration)

# Follow-up migration for databases where the first migration is already applied.
Path('supabase/migrations/20260725213000_vastgoedrekenen_verkrijgingstypen_mixed_use.sql').write_text("""-- Beschrijvende mixed-use typen voor de huidige situatie bij verkrijging.
-- Deze typen bepalen geen OVB-tarief; de fiscale classificatie blijft afzonderlijk.

alter table public.calculation_acquisition_components
  drop constraint if exists calculation_acquisition_components_component_type_check;

alter table public.calculation_acquisition_components
  add constraint calculation_acquisition_components_component_type_check
  check (component_type in (
    'woning', 'appartement', 'studio', 'kamer',
    'winkelruimte', 'kantoorruimte', 'bedrijfsruimte', 'bedrijfsunit',
    'opslagruimte', 'kelder', 'parkeerplaats', 'garagebox', 'berging',
    'horeca', 'maatschappelijk', 'ontwikkelgrond',
    'woon_winkelpand', 'woon_kantoorpand', 'woon_bedrijfspand',
    'winkel_kantoorpand', 'mixed_use', 'mixed_use_overig', 'overig'
  ));

comment on column public.calculation_acquisition_components.component_type is
  'Beschrijvend huidig pand-/gebruikstype bij verkrijging; bepaalt niet automatisch de OVB-classificatie.';
""")

# Lightweight regression checks.
Path('src/test/ui/acquisitionMixedUseTypes.test.ts').write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACQUISITION_COMPONENT_TYPE_LABELS } from '@/lib/vastgoedrekenen/acquisition';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('beschrijvende mixed-use verkrijgingstypen', () => {
  it('biedt woon-winkelpand en gangbare gecombineerde huidige typen aan', () => {
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.woon_winkelpand).toBe('Woon-winkelpand');
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.woon_kantoorpand).toBe('Woon-kantoorpand');
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.woon_bedrijfspand).toBe('Woon-bedrijfspand');
    expect(ACQUISITION_COMPONENT_TYPE_LABELS.mixed_use).toContain('Mixed-use');
  });

  it('gebruikt de verkrijgingstypen alleen in de verkrijgingsinterface', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx');
    expect(table).toContain('ACQUISITION_COMPONENT_TYPE_LABELS');
    expect(table).not.toContain('Object.entries(VR_COMPONENT_LABELS)');
  });

  it('houdt huidig type en fiscale OVB-classificatie als afzonderlijke velden', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx');
    expect(table).toContain('Field label="Huidig type"');
    expect(table).toContain('Field label="OVB-classificatie"');
  });
});
""")
