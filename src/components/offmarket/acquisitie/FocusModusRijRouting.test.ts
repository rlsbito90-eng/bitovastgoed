import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/FocusModus.tsx'),
  'utf8',
);

describe('FocusModus rij-routing', () => {
  it('behoudt bij een nieuwe Focus-sessie de expliciet aangevraagde index', () => {
    expect(bron).toContain('const hervatOpgeslagen = Boolean(opgeslagen && kanHervatten(opgeslagen, aangevraagdeScopeIds));');
    expect(bron).toContain('const explicietGekozenId = beschikbareIds[veiligIndex] ?? null;');
    expect(bron).toMatch(/const volgendeId = hervatOpgeslagen[\s\S]*explicietGekozenId && rondeIds\.includes\(explicietGekozenId\)[\s\S]*\? explicietGekozenId/);
  });

  it('blijft een echte bestaande werkronde hervatten wanneer die compatibel is', () => {
    expect(bron).toMatch(/hervatOpgeslagen[\s\S]*eerstVolgendeId\(ronde, rondeIds\)/);
  });
});
