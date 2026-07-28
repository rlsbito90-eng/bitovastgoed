import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('verkrijgingsstructuur UX', () => {
  it('scheidt verkrijging van toekomstige strategie-units', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx');
    expect(table).toContain('Verkrijgingsstructuur & OVB');
    expect(table).toContain('Gekoppelde toekomstige strategie-units');
    expect(table).toContain('Totale berekende OVB');
  });

  it('gebruikt verkrijgingscomponenten als optioneel leidend OVB-pad', () => {
    const compute = source('src/lib/vastgoedrekenen/compute.ts');
    expect(compute).toContain('hasSeparateAcquisitionStructure');
    expect(compute).toContain('ovbComponents');
  });

  it('toont geen misleidend verschil met vraagprijs in de componentstrategie', () => {
    const wrapper = source('src/components/vastgoedrekenen/ComponentStrategyTable.tsx');
    const strategy = source('src/components/vastgoedrekenen/ComponentStrategyTableLegacy.tsx');
    expect(wrapper).toContain('ComponentStrategyTableLegacy');
    expect(wrapper).toContain('ComponentAllocationTimingWorkspace');
    expect(strategy).not.toContain('Verschil met vraagprijs');
    expect(strategy).toContain('Bruto verkoopwaarde');
    expect(strategy).toContain('Verkoop- en juridische kosten');
  });
});
