import { describe, expect, it } from 'vitest';
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
