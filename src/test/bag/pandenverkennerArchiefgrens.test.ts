import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pagina = readFileSync('src/pages/VastgoedkansenVindenPage.tsx', 'utf8');
const badge = readFileSync('src/components/bag/BagCrmMatchBadge.tsx', 'utf8');
const kaart = readFileSync('src/components/bag/BagPandenKaartRuntime.tsx', 'utf8');

describe('Pandenverkenner archiefgrens', () => {
  it('neemt actieve én gearchiveerde Vastgoedkansen mee in de duplicaatblokkade', () => {
    expect(pagina).toContain('const { kansen, archief, addKans } = useVastgoedkansen();');
    expect(pagina).toContain('const alleVastgoedkansen = useMemo(() => [...kansen, ...archief]');
    expect(pagina).toContain('...alleVastgoedkansen.map(k => k.bagPandId)');
    expect(pagina).toContain('...alleVastgoedkansen.map(k => norm(`${k.adres}|${k.postcode}`))');
  });

  it('kan een gearchiveerde Vastgoedkans als zodanig labelen en heropenen', () => {
    expect(badge).toContain('const { kansen, archief, restoreKansen } = useVastgoedkansen();');
    expect(badge).toContain('...alleVastgoedkansen.map(kans =>');
    expect(badge).toContain("label = 'Gearchiveerd'");
    expect(badge).toContain('vastgoedkans?.archivedAt');
    expect(badge).toContain('restoreKansen([vastgoedkans.id])');
  });

  it('gebruikt het archief ook voor kaartmatch en workflowkleur', () => {
    expect(kaart).toContain('const { kansen, archief } = useVastgoedkansen();');
    expect(kaart).toContain('...alleVastgoedkansen.map(kans =>');
    expect(kaart).toContain('const kans = alleVastgoedkansen.find');
    expect(kaart).toContain('vastgoedkansGearchiveerd: Boolean(kans?.archivedAt)');
  });
});
