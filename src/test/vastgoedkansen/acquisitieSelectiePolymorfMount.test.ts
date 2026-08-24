import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const selectieTab = fs.readFileSync(
  'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx',
  'utf8',
);
const crmApp = fs.readFileSync('src/CrmProtectedApp.tsx', 'utf8');

describe('Acquisitieselectie — uniforme bronpresentatie', () => {
  it('laat Vastgoedkansen aansluiten op dezelfde resultatenlijst in plaats van een aparte sectie', () => {
    expect(selectieTab).not.toContain('VastgoedkansenInAcquisitieSelectie');
    expect(selectieTab).toContain('VastgoedkansAcquisitieRij');
    expect(selectieTab).toContain('data-testid="acquisitie-selectie-lijst"');
  });

  it('biedt een bronfilter voor Alles, Radar en Pandenverkenner', () => {
    expect(selectieTab).toContain('data-testid="acquisitie-bronfilter"');
    expect(selectieTab).toContain('acquisitie-bron-alles');
    expect(selectieTab).toContain('acquisitie-bron-radar');
    expect(selectieTab).toContain('acquisitie-bron-pandenverkenner');
  });

  it('houdt de productie-routes onder de VastgoedkansenProvider', () => {
    expect(crmApp).toContain('<VastgoedkansenProvider>');
    expect(crmApp).toContain('</VastgoedkansenProvider>');
  });
});