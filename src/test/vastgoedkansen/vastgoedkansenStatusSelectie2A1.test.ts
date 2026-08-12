import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const pagina = fs.readFileSync('src/pages/VastgoedkansenPage.tsx', 'utf8');
const hook = fs.readFileSync('src/hooks/useVastgoedkansen.tsx', 'utf8');
const model = fs.readFileSync('src/lib/vastgoedkansen.ts', 'utf8');
const migratie = fs.readFileSync('supabase/migrations/20260812231500_vastgoedkansen_archief_lifecycle.sql', 'utf8');

describe('BUILD 2.0A.1 — Vastgoedkansen status & selectie', () => {
  it('gebruikt soft archive met heropenbare lifecycle', () => {
    expect(migratie).toContain('archived_at timestamptz');
    expect(migratie).toContain('archived_by uuid');
    expect(migratie).toContain('archived_reason text');
    expect(model).toContain('archivedAt:string|null');
    expect(hook).toContain('archiveKansen');
    expect(hook).toContain('restoreKansen');
    expect(hook).toContain("archived_at:nu");
    expect(hook).toContain("archived_at:null");
  });

  it('ondersteunt individueel en bulk selecteren in de lijst', () => {
    expect(pagina).toContain('Selecteren');
    expect(pagina).toContain('Selecteer alle zichtbare vastgoedkansen');
    expect(pagina).toContain('geselecteerd.size');
    expect(pagina).toContain('toggleKans');
    expect(pagina).toContain('toggleAlles');
  });

  it('maakt archiveren en heropenen expliciete bevestigde acties', () => {
    expect(pagina).toContain('AlertDialog');
    expect(pagina).toContain('Vastgoedkansen archiveren?');
    expect(pagina).toContain('Vastgoedkansen heropenen?');
    expect(pagina).toContain('blijven met historie beschikbaar in Archief');
    expect(pagina).toContain("setBevestigActie('archiveren')");
    expect(pagina).toContain("setBevestigActie('heropenen')");
  });
});
