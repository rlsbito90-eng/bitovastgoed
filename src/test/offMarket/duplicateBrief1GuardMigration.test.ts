import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260826193000_radar_duplicate_brief1_guard.sql'),
  'utf8',
);

describe('Radar duplicate Brief 1 database guard', () => {
  it('blokkeert alleen een nieuwe post-Brief 1 met een sterke geadresseerde-key', () => {
    expect(sql).toContain("coalesce(new.kanaal, 'post') <> 'post'");
    expect(sql).toContain("new.campagne_stap is distinct from 'brief_1'");
    expect(sql).toContain("nullif(btrim(new.geadresseerde_key), '') is null");
  });

  it('respecteert verzonden partijhistorie over signalen heen', () => {
    expect(sql).toContain('b.geadresseerde_key = new.geadresseerde_key');
    expect(sql).toContain("b.status = 'verstuurd'");
    expect(sql).toContain("b.campagne_stap in ('brief_1', 'brief_2', 'brief_3')");
  });

  it('blokkeert ook een parallel Brief-1-concept op een ander signaal', () => {
    expect(sql).toContain('b.signaal_id is distinct from new.signaal_id');
    expect(sql).toContain("b.status in ('concept', 'definitief')");
    expect(sql).toContain("b.campagne_stap = 'brief_1'");
  });

  it('wijzigt geen historische brieven en geeft een expliciete herstelroute', () => {
    expect(sql).not.toMatch(/update\s+public\.off_market_brieven/i);
    expect(sql).toContain('Gebruik Radar-brieven om de juiste campagnestap of context te bepalen.');
    expect(sql).toContain('start niet opnieuw bij Brief 1');
  });
});
