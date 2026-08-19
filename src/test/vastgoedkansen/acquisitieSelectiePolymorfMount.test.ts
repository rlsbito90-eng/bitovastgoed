import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const selectieTab = fs.readFileSync(
  'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx',
  'utf8',
);
const crmApp = fs.readFileSync('src/CrmProtectedApp.tsx', 'utf8');

describe('BUILD 2.0A.3 — polymorfe selectie mountgrens', () => {
  it('mount de Vastgoedkansen-sectie alleen wanneer de selectie Vastgoedkansen bevat', () => {
    expect(selectieTab).toContain(
      '{heeftVastgoedkansen && <VastgoedkansenInAcquisitieSelectie items={items} />}',
    );
  });

  it('houdt de productie-routes onder de VastgoedkansenProvider', () => {
    expect(crmApp).toContain('<VastgoedkansenProvider>');
    expect(crmApp).toContain('</VastgoedkansenProvider>');
  });
});
