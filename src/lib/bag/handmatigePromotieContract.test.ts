import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dialog = readFileSync(resolve(process.cwd(), 'src/components/bag/BagHandmatigePromotieDialog.tsx'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'src/pages/VastgoedkansenVindenPage.tsx'), 'utf8');

describe('BAG 2A.12 handmatige promotiegrens', () => {
  it('behoudt een afzonderlijke expliciete modal zonder dubbele checkbox', () => {
    expect(dialog).toContain('AlertDialog');
    expect(dialog).toContain('toevoegen aan Vastgoedkansen');
    expect(dialog).toContain('geen Objecten of Deals');
    expect(dialog).toContain('geen Kadaster-, eigenaar-, brief- of andere vervolgactie');
    expect(dialog).not.toContain('checked={bevestigd}');
    expect(dialog).not.toContain('disabled={!bevestigd || bezig}');
  });

  it('rapporteert per BAG-ID succes of mislukking zonder automatische retry', () => {
    expect(page).toContain("const resultaat: BagPromotieResultaat = { toegevoegd: [], mislukt: [] }");
    expect(page).toContain('resultaat.toegevoegd.push(pand.bagPandId)');
    expect(page).toContain('resultaat.mislukt.push(pand.bagPandId)');
    expect(page).not.toMatch(/retry|setInterval|setTimeout/i);
  });
});
