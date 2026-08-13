import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const hook = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useAcquisitieBrieven.tsx'), 'utf8');
const kaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/VastgoedkansConceptbriefKaart.tsx'), 'utf8');
const statuskaart = fs.readFileSync(path.join(process.cwd(), 'src/components/acquisitie/AcquisitieBrievenStatusKaart.tsx'), 'utf8');

describe('BUILD 2.0C.2 — Vastgoedkans conceptbrief', () => {
  it('leest brieven uitsluitend op vastgoedkans_id', () => {
    expect(hook).toContain("queryKey: ['off_market_brieven', 'vastgoedkans', vastgoedkansId]");
    expect(hook).toContain(".eq('vastgoedkans_id', vastgoedkansId)");
  });

  it('schrijft een Vastgoedkans-concept zonder fake signaal', () => {
    expect(hook).toContain('signaal_id: null');
    expect(hook).toContain('vastgoedkans_id: vastgoedkansId');
    expect(hook).toContain("status: 'concept'");
    expect(hook).toContain("event_type: 'concept_created'");
    expect(hook).toContain('vastgoedkans_id: vastgoedkansId');
  });

  it('kan alleen een concept van hetzelfde Vastgoedkans-dossier bijwerken', () => {
    expect(hook).toContain(".eq('id', input.id)");
    expect(hook).toContain(".eq('vastgoedkans_id', vastgoedkansId)");
    expect(hook).toContain(".eq('status', 'concept')");
  });

  it('houdt Off-Market-verzending en automatische Vastgoedkans-mutatie buiten deze flow', () => {
    expect(hook).not.toContain('useMarkBriefVerstuurd');
    expect(hook).not.toContain('updateKans');
    expect(kaart).not.toContain('useMarkBriefVerstuurd');
    expect(kaart).not.toContain('updateKans');
  });

  it('is alleen actief voor Vastgoedkansen en pas na eigenaar/relatiekoppeling', () => {
    expect(statuskaart).toContain("model.dossier.bronType === 'vastgoedkans'");
    expect(statuskaart).toContain('enabled={model.eigenaarBekend && model.relatieGekoppeld}');
    expect(statuskaart).toContain('vastgoedkansId={model.dossier.bronId}');
  });
});
