import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/FocusModus.tsx'),
  'utf8',
);

describe('Focus enkelvoudige rijscope', () => {
  it('maakt zonder expliciete meervoudige scope alleen het gekozen huidige item actief', () => {
    expect(bron).toContain("const explicietGekozenId = beschikbareIds[veiligIndex] ?? null;");
    expect(bron).toMatch(/focusScopeIds\?\.length[\s\S]*\[explicietGekozenId\][\s\S]*beschikbareIds/);
  });

  it('gebruikt dezelfde afgebakende scope voor werkronde en Kadasterselectie', () => {
    expect(bron).toContain('scopeIds: aangevraagdeScopeIds');
    expect(bron).toContain('new Set(aangevraagdeScopeIds)');
  });
});
