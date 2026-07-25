import { readFileSync } from 'node:fs';
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
