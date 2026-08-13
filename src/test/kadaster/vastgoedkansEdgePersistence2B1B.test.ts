import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexBron = fs.readFileSync(path.join(root, 'supabase/functions/kadaster-objectinformatie/index.ts'), 'utf8');
const persistBron = fs.readFileSync(path.join(root, 'supabase/functions/kadaster-objectinformatie/_persist.ts'), 'utf8');

describe('BUILD 2.0B.1B — Kadaster Edge-persistence voor Vastgoedkansen', () => {
  it('gebruikt vastgoedkans_id als eigen persist-target', () => {
    expect(indexBron).toContain('vastgoedkans_id: z.string().uuid().nullish()');
    expect(indexBron).toContain('vastgoedkansId: body.context?.vastgoedkans_id ?? null');
    expect(persistBron).toContain('vastgoedkans_id: args.vastgoedkansId');
    expect(persistBron).not.toContain('signaal_id: args.vastgoedkansId');
    expect(persistBron).not.toContain('object_id: args.vastgoedkansId');
  });

  it('valideert de Vastgoedkans vóór de betaalde report-call', () => {
    const validatePos = indexBron.indexOf(".from('vastgoedkansen')");
    const reportPos = indexBron.indexOf('fetch(upstreamUrl');
    expect(validatePos).toBeGreaterThan(-1);
    expect(reportPos).toBeGreaterThan(validatePos);
    expect(indexBron).toContain('Vastgoedkans bestaat niet of is niet toegankelijk.');
  });

  it('blokkeert PDF en gemengde targets voor Vastgoedkansen', () => {
    expect(indexBron).toContain('Kadasterbericht/PDF is voor Vastgoedkansen nog niet geactiveerd.');
    expect(indexBron).toContain('Vastgoedkans-context mag niet met object_id of signaal_id worden gecombineerd.');
  });

  it('houdt automatische retry buiten de bestaande hook', () => {
    const hookBron = fs.readFileSync(path.join(root, 'src/hooks/useKadasterObjectinformatie.tsx'), 'utf8');
    expect(hookBron).toContain('retry: false');
  });
});
