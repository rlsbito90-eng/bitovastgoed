import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Vastgoedrekenen Fase 1.1 acceptatie-UX', () => {
  it('registreert GBO, VVO en BVO afzonderlijk in de componentstrategie', () => {
    const code = source('src/components/vastgoedrekenen/ComponentStrategyTable.tsx');
    expect(code).toContain('GBO — gebruiksoppervlakte (m²)');
    expect(code).toContain('VVO — verhuurbare vloeroppervlakte (m²)');
    expect(code).toContain('BVO — bruto vloeroppervlakte (m²)');
    expect(code).toContain('SurfaceCell gbo={gbo} vvo={vvo} bvo={bvo}');
    expect(code).not.toContain('fmtM2(m2, 0)');
  });

  it('verbergt de algemene Deal Cockpit en gebruikt één kolom op Vastgoedrekenen', () => {
    const code = source('src/pages/ObjectDetailPage.tsx');
    expect(code).toContain("activeTab === 'vastgoedrekenen' ? 'grid-cols-1'");
    expect(code).toContain("activeTab === 'vastgoedrekenen' ? 'hidden'");
  });

  it('beheert het centrale register buiten de objectquickscan', () => {
    const detail = source('src/components/vastgoedrekenen/VastgoedrekenenTab.tsx');
    const overview = source('src/pages/VastgoedrekenenPage.tsx');
    expect(detail).not.toContain('KengetallenRegisterPanel');
    expect(detail).toContain('ScenarioKengetallenPanel');
    expect(overview).toContain('KengetallenRegisterPanel');
  });
});
