import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/TakenPage.tsx'), 'utf8');
const state = readFileSync(resolve(process.cwd(), 'src/lib/takenViewState.ts'), 'utf8');

describe('Mijn werk — Today v1', () => {
  it('start standaard op Vandaag en gebruikt rustige werkweergaven', () => {
    expect(state).toContain("tab: 'vandaag'");
    expect(state).toContain("'vandaag' | 'komend' | 'openstaand' | 'wachten' | 'alles' | 'afgerond'");
    expect(page).toContain('title="Mijn werk"');
    expect(page).toContain("{ value: 'vandaag', label: 'Vandaag' }");
    expect(page).toContain("{ value: 'komend', label: 'Komend' }");
    expect(page).toContain("{ value: 'openstaand', label: 'Openstaand' }");
  });

  it('neemt verlopen taken op in Vandaag en groepeert de dag op dagdelen', () => {
    expect(page).toContain("isTaakTeLaat(t, now) || isTaakVandaag(t, now)");
    expect(page).toContain("renderSection('Te laat'");
    expect(page).toContain("renderSection('Ochtend'");
    expect(page).toContain("renderSection('Middag'");
    expect(page).toContain("renderSection('Later vandaag'");
  });

  it('houdt snelle acties, CRM-context en mobiele taakrij intact', () => {
    expect(page).toContain('data-testid="taken-lijstregel"');
    expect(page).toContain('grid grid-cols-[auto,minmax(0,1fr)]');
    expect(page).toContain('col-start-2 row-start-2 flex min-w-0 flex-wrap');
    expect(page).toContain('Op wachten zetten');
    expect(page).toContain('Open relatie');
    expect(page).toContain('Open object');
    expect(page).toContain('Open deal');
  });
});
