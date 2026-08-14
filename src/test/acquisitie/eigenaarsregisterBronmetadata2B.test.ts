import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const hookBron = fs.readFileSync(path.join(root, 'src/hooks/useEigenaarsregister.tsx'), 'utf8');

describe('FIX 2.0B — bronmetadata van eigenaar blijft behouden', () => {
  it('merge bestaande bron_details voordat Kadaster-sync nieuwe details schrijft', () => {
    expect(hookBron).toContain('const payloadMetBronhistorie = {');
    expect(hookBron).toContain('...(eigenaar.bron_details ?? {})');
    expect(hookBron).toContain('...payload.bron_details');
    expect(hookBron).toContain('Object.entries(payloadMetBronhistorie)');
  });
});
