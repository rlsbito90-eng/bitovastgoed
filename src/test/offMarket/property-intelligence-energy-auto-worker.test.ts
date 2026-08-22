import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worker = fs.readFileSync(path.join(root, 'supabase/functions/vastgoed-energy-auto-worker/index.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260822200500_activate_vastgoed_energy_auto_worker.sql'), 'utf8');

describe('Vastgoed Intelligence automatische energieverrijking', () => {
  it('selecteert uitsluitend betrouwbare BAG-doelobjecten', () => {
    expect(worker).toContain(".eq('bag_status', 'verrijkt')");
    expect(worker).toContain(".eq('bag_match_kwaliteit', 'exact')");
    expect(worker).toContain("bag_geselecteerd_vbo_id");
    expect(worker).toMatch(/\^\\d\{16\}\$/);
  });

  it('gebruikt bestaande snapshots als cache en forceert geen nieuwe call', () => {
    expect(worker).toContain("vastgoed_energielabel_snapshots");
    expect(worker).toContain("energy_refresh_days");
    expect(worker).toContain("force: false");
  });

  it('is apart schakelbaar en draait maximaal iedere vijf minuten', () => {
    expect(worker).toContain("auto_energy_after_bag");
    expect(migration).toContain("auto_energy_after_bag = true");
    expect(migration).toContain("'*/5 * * * *'");
    expect(migration).toContain("vastgoed-energy-auto-five-minutely");
  });

  it('bevat geen automatische Kadaster- of AI-koppeling', () => {
    expect(worker).not.toMatch(/off-market-kadaster|kadaster-ophalen|kadaster-product/i);
    expect(worker).not.toMatch(/openai|anthropic|gemini|off-market-enrich-signaal/i);
  });
});
