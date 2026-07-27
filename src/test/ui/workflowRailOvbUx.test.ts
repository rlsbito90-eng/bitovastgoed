import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('rustige werkstroom en verkrijgings-OVB', () => {
  it('opent standaard één relevante of laatst gebruikte sectie', () => {
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(editor).toContain('vastgoedrekenen:last-open-section');
    expect(editor).toContain('const defaultOpenMap = buildUniformOpenState(false)');
    expect(editor).toContain('defaultOpenMap[preferredSection] = true');
  });

  it('leidt railstatus af uit concrete herstelacties', () => {
    const editor = source('src/components/vastgoedrekenen/ScenarioEditor.tsx');
    expect(editor).toContain('statusWithActions');
    expect(editor).toContain("'sec-aankoop': { status: statusWithActions('sec-aankoop', 'ok')");
  });

  it('toont in ingeklapte rail een vinkje voor klaar en een nummer voor aandacht', () => {
    const rail = source('src/components/vastgoedrekenen/cockpit/SectionRail.tsx');
    expect(rail).toContain("item.status === 'ok'");
    expect(rail).toContain('{item.number}');
  });

  it('benoemt huidige staat en toekomstige strategiewaarde expliciet', () => {
    const table = source('src/components/vastgoedrekenen/cockpit/ComponentenTable.tsx');
    expect(table).toContain('Huidige componentwaarde bij verkrijging');
    expect(table).toContain('Toekomstige strategiewaarde — indicatief');
    expect(table).toContain('actuele aankoopprijs bij verkrijging');
  });
});
