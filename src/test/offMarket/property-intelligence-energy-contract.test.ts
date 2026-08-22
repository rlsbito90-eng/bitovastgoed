import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const energyPath = path.join(root, 'supabase/functions/vastgoed-energy-verrijk/index.ts');
const migrationPath = path.join(root, 'supabase/migrations/20260822175500_vastgoed_intelligence_energy_planology.sql');

const energy = fs.readFileSync(energyPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');

describe('Vastgoed Intelligence energiecontract', () => {
  it('is fail-closed en gebruikt EP-Online uitsluitend server-side', () => {
    expect(energy).toContain("EP_ONLINE_API_KEY");
    expect(energy).toContain("energy_enabled");
    expect(energy).toContain("Energieverrijking staat uit");
    expect(energy).toContain("https://public.ep-online.nl/api/v5");
    expect(energy).toContain("PandEnergielabel/AdresseerbaarObject/");
    expect(energy).toContain("Authorization: apiKey");
  });

  it('is BAG-gecentreerd en schrijft historische snapshots', () => {
    expect(migration).toContain('vastgoed_energielabel_snapshots');
    expect(migration).toContain('bag_vbo_id text not null');
    expect(migration).toContain("bron text not null default 'ep_online'");
    expect(energy).toContain("from('vastgoed_energielabel_snapshots')");
    expect(energy).toContain("bag_vbo_id: bagVboId");
  });

  it('mapt de actuele EP-Online v5 NTA-velden en behandelt ontbrekende getallen als null', () => {
    expect(energy).toContain("value === null || value === undefined || value === ''");
    expect(energy).toContain("'PrimaireFossieleEnergie'");
    expect(energy).toContain("'Geldig_tot'");
    expect(energy).toContain("energie_index: num(");
  });

  it('bevat geen automatische Kadaster- of AI-koppeling', () => {
    expect(energy).not.toMatch(/off-market-kadaster|kadaster-ophalen|kadaster-data|kadaster-product/i);
    expect(energy).not.toMatch(/fetch\([^)]*kadaster/i);
    expect(energy).not.toMatch(/openai|anthropic|gemini/i);
  });

  it('staat standaard uit in databaseconfig', () => {
    expect(migration).toContain('energy_enabled boolean not null default false');
    expect(migration).toContain('auto_energy_after_bag boolean not null default false');
  });
});
