import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const badge = readFileSync('src/components/bag/BagCrmMatchBadge.tsx', 'utf8');
const selectie = readFileSync('src/components/offmarket/acquisitie/VastgoedkansenInAcquisitieSelectie.tsx', 'utf8');

describe('Pandenverkenner → Acquisitieselectie deep-link', () => {
  it('stuurt een Vastgoedkans in Acquisitieselectie naar de gedeelde werkbank', () => {
    expect(badge).toContain("sessionStorage.setItem('off-market-filter:tab', 'acquisitieselectie')");
    expect(badge).toContain('`/off-market?vastgoedkans=${encodeURIComponent(match.recordId)}`');
    expect(badge).toContain('Open Acquisitieselectie');
    expect(badge).toContain("label = 'In Acquisitieselectie'");
  });

  it('focust het aangewezen bestaande Vastgoedkans-dossier in de werkbank', () => {
    expect(selectie).toContain("const focusVastgoedkansId = searchParams.get('vastgoedkans')");
    expect(selectie).toContain('data-vastgoedkans-id={kans.id}');
    expect(selectie).toContain("scrollIntoView({ block: 'center', behavior: 'smooth' })");
    expect(selectie).toContain('Geselecteerd dossier');
  });

  it('maakt voor deze navigatie geen nieuwe selectie of Vastgoedkans aan', () => {
    expect(badge).not.toContain('.insert(');
    expect(selectie).not.toContain('.insert(');
    expect(selectie).not.toContain('addKans(');
  });
});
