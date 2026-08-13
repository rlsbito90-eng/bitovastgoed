import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const relatieBron = fs.readFileSync(path.join(root, 'src/components/acquisitie/VastgoedkansEigenaarRelatieKaart.tsx'), 'utf8');

describe('BUILD 2.0B owner model regression', () => {
  it('houdt nieuwe Kadaster-eigenaren buiten Relaties', () => {
    expect(relatieBron).toContain('Kadaster-eigenaren blijven acquisitiedata');
    expect(relatieBron).toContain('bouwKadasterEigenaarVoorstellen');
    expect(relatieBron).toContain('vindCrmMatches');
    expect(relatieBron).not.toContain('<QuickCreateRelationDialog');
    expect(relatieBron).not.toContain('Nieuwe relatie aanmaken');
  });
});
