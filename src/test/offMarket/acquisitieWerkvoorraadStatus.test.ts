import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('acquisitieselectie — werkvoorraadstatus', () => {
  it('bewaart apart gezette dossiers additief met een begrensde statusset', () => {
    const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260826173152_acquisitie_selectie_werkvoorraadstatus.sql'), 'utf8');
    expect(sql).toContain("add column if not exists werkvoorraad_status text not null default 'actief'");
    expect(sql).toContain("'gebundeld_bij_partij'");
    expect(sql).toContain("'eerder_benaderd'");
    expect(sql).toContain("'benadering_bepalen'");
    expect(sql).toContain("'niet_benaderen'");
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('toont actieve en apart gezette dossiers als expliciete filters', () => {
    const ui = fs.readFileSync(path.join(root, 'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx'), 'utf8');
    expect(ui).toContain('Actief (${werkvoorraadTellingen.actief})');
    expect(ui).toContain('Apart gezet (${werkvoorraadTellingen.apart})');
    expect(ui).toContain('acquisitie-werkvoorraadstatus-select');
    expect(ui).toContain('werkvoorraad_volgende_actie_op');
  });

  it('laat de hoofdtab alleen de actieve dagelijkse werkvoorraad tellen', () => {
    const hook = fs.readFileSync(path.join(root, 'src/hooks/useAcquisitieSelectie.tsx'), 'utf8');
    expect(hook).toContain("(item.werkvoorraad_status ?? 'actief') === 'actief'");
  });
});
