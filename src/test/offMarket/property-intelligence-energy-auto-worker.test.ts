import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worker = fs.readFileSync(path.join(root, 'supabase/functions/vastgoed-energy-auto-worker/index.ts'), 'utf8');
const activation = fs.readFileSync(path.join(root, 'supabase/migrations/20260822200500_activate_vastgoed_energy_auto_worker.sql'), 'utf8');
const candidates = fs.readFileSync(path.join(root, 'supabase/migrations/20260822202000_vastgoed_energy_auto_candidates.sql'), 'utf8');
const energy = fs.readFileSync(path.join(root, 'supabase/functions/vastgoed-energy-verrijk/index.ts'), 'utf8');

describe('Vastgoed Intelligence automatische energieverrijking', () => {
  it('selecteert betrouwbare BAG-doelobjecten via een schaalbare service-role RPC', () => {
    expect(worker).toContain("admin.rpc(\n    'vastgoed_energy_auto_candidates'");
    expect(candidates).toContain("s.bag_status = 'verrijkt'");
    expect(candidates).toContain("s.bag_match_kwaliteit = 'exact'");
    expect(candidates).toContain("s.bag_geselecteerd_vbo_id ~ '^\\d{16}$'");
    expect(candidates).toContain('not exists');
    expect(candidates).toContain('vastgoed_energielabel_snapshots');
    expect(candidates).toContain('grant execute on function public.vastgoed_energy_auto_candidates(integer) to service_role');
    expect(candidates).toContain('revoke all on function public.vastgoed_energy_auto_candidates(integer) from public, anon, authenticated');
  });

  it('forceert geen externe refresh en cachet ook geen-label resultaten', () => {
    expect(worker).toContain('force: false');
    expect(energy).toContain("status: 'geen_label'");
    expect(energy).toContain('found: recent.status !== \'geen_label\'');
    expect(energy).toContain('raw_payload: {}');
  });

  it('is apart schakelbaar en draait maximaal iedere vijf minuten', () => {
    expect(worker).toContain('auto_energy_after_bag');
    expect(activation).toContain('auto_energy_after_bag = true');
    expect(activation).toContain("'*/5 * * * *'");
    expect(activation).toContain('vastgoed-energy-auto-five-minutely');
  });

  it('bevat geen automatische Kadaster- of AI-koppeling', () => {
    expect(worker).not.toMatch(/off-market-kadaster|kadaster-ophalen|kadaster-product/i);
    expect(worker).not.toMatch(/openai|anthropic|gemini|off-market-enrich-signaal/i);
  });
});
