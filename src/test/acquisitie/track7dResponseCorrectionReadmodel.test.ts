import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260816083000_track_7d_response_correction_readmodel.sql',
);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

describe('TRACK-7D correctiebewuste responsmeting', () => {
  it('behoudt audit-events en herbouwt alleen de bestaande tracking-view', () => {
    expect(sql).toContain('create or replace view public.acquisitie_tracking_events_v1');
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
    expect(sql).not.toMatch(/\bupdate\s+public\./);
    expect(sql).not.toMatch(/\binsert\s+into\b/);
    expect(sql).not.toMatch(/\bdrop\s+table\b/);
  });

  it('herkent respons_verwijderd als correctie en telt alleen een canonieke actieve respons', () => {
    expect(sql).toContain("e.status = 'respons_verwijderd'");
    expect(sql).toContain('laatste_respons_verwijderd_op');
    expect(sql).toContain('canonieke_respons_event_op');
    expect(sql).toContain("e.actuele_responsstatus not in ('geen_reactie','retour_post')");
    expect(sql).toContain("then 'reactie_verwijderd'");
    expect(sql).toContain("then 'reactie_gecorrigeerd'");
  });

  it('maakt positieve respons en retourpost eveneens current-state/correctiebewust', () => {
    expect(sql).toContain("e.actuele_responsstatus in ('interesse','wil_meer_informatie','gesprek_gepland')");
    expect(sql).toContain('canonieke_retour_event_op');
    expect(sql).toContain("e.actuele_responsstatus = 'retour_post'");
    expect(sql).toContain("e.actuele_verzendstatus = 'retour'");
  });
});
