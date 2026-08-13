import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexBron = fs.readFileSync(path.join(root, 'supabase/functions/kadaster-objectinformatie/index.ts'), 'utf8');
const persistBron = fs.readFileSync(path.join(root, 'supabase/functions/kadaster-objectinformatie/_persist.ts'), 'utf8');
const pdfBron = fs.readFileSync(path.join(root, 'supabase/functions/kadaster-objectinformatie/_pdf.ts'), 'utf8');
const migratieBron = fs.readFileSync(path.join(root, 'supabase/migrations/20260813181500_kadaster_documenten_vastgoedkans.sql'), 'utf8');

describe('BUILD 2.0B — Kadaster persistence voor Vastgoedkansen', () => {
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

  it('staat PDF toe voor precies één dossierdoel en geeft vastgoedkans_id door', () => {
    expect(indexBron).not.toContain('Kadasterbericht/PDF is voor Vastgoedkansen nog niet geactiveerd.');
    expect(indexBron).toContain('Kadaster-context mag maar één dossierdoel bevatten.');
    expect(indexBron).toContain('vastgoedkansId: body.context?.vastgoedkans_id ?? null');
    expect(pdfBron).toContain('args.vastgoedkansId');
    expect(pdfBron).toContain('Kadasterbericht vereist precies één dossierdoel.');
    expect(pdfBron).toContain('vastgoedkans_id: args.vastgoedkansId');
    expect(pdfBron).toContain('vastgoedkans/${args.vastgoedkansId}/kadaster');
  });

  it('breidt kadaster_documenten additief uit met Vastgoedkans-target', () => {
    expect(migratieBron).toContain('ADD COLUMN IF NOT EXISTS vastgoedkans_id uuid');
    expect(migratieBron).toContain('REFERENCES public.vastgoedkansen(id) ON DELETE SET NULL');
    expect(migratieBron).toContain('object_id IS NOT NULL OR signaal_id IS NOT NULL OR vastgoedkans_id IS NOT NULL');
    expect(migratieBron).toContain('idx_kadaster_documenten_vastgoedkans_id');
  });

  it('houdt automatische retry buiten de bestaande hook', () => {
    const hookBron = fs.readFileSync(path.join(root, 'src/hooks/useKadasterObjectinformatie.tsx'), 'utf8');
    expect(hookBron).toContain('retry: false');
  });
});
