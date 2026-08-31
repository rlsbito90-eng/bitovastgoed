import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Unified Object / Deal lifecycle UX', () => {
  it('beheert Objectstatus niet meer vanuit het algemene bewerkformulier', () => {
    const source = read('src/components/forms/ObjectFormDialog.tsx');

    expect(source).not.toContain('label="Objectstatus"');
    expect(source).not.toContain("set('status', e.target.value as ObjectStatus)");
  });

  it('biedt beschikbaarheid en trajectfase samen aan vanuit Dealflow', () => {
    const source = read('src/components/pipeline/ObjectPipelineFaseSectie.tsx');

    expect(source).toContain('Beschikbaarheid');
    expect(source).toContain('Objectstatus');
    expect(source).toContain('Trajectfase');
    expect(source).toContain("'preferred_bidder'");
  });

  it('maakt de primaire dashboardlaag Object-first en gebruikt de canonieke feeprojectie', () => {
    const source = read('src/pages/DashboardPage.tsx');

    expect(source).toContain('Actief aanbodvolume');
    expect(source).toContain('Actieve objecten');
    expect(source).toContain('Beschikbaar');
    expect(source).toContain('useUnifiedFeeReporting');
    expect(source).toContain('1 economische fee per object');
  });

  it('archiveert terminale Objectstatussen centraal in de datastore', () => {
    const source = read('src/hooks/useDataStore.tsx');

    expect(source).toContain("o.status === 'verkocht' || o.status === 'ingetrokken'");
    expect(source).toContain('payload.isArchived = true');
    expect(source).toContain('payload.archivedAt = new Date().toISOString()');
  });
});
