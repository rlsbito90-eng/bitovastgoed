import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260816092500_acquisitie_response_correction_kpi.sql',
);

const sql = fs.readFileSync(migrationPath, 'utf8');

describe('TRACK-7D responscorrectie meetcontract', () => {
  it('bepaalt de laatste response_received-mutatie per brief', () => {
    expect(sql).toContain("select distinct on (e.brief_id)");
    expect(sql).toContain("where e.event_type = 'response_received'");
    expect(sql).toContain('order by e.brief_id, e.event_date desc, e.created_at desc, e.id desc');
  });

  it('sluit verwijderde en geen-reactie staten uit van responsmeting', () => {
    expect(sql).toContain("not in ('geen_reactie', 'respons_verwijderd')");
    expect(sql).toContain("not in ('geen_reactie','respons_verwijderd')");
    expect(sql).toContain("then 'reactie_verwijderd'");
  });

  it('laat auditdata intact en wijzigt alleen de read-view', () => {
    expect(sql).toContain('create or replace view public.acquisitie_tracking_events_v1');
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\.off_market_brief_events\b/i);
    expect(sql).not.toMatch(/\binsert\s+into\s+public\.off_market_brief_events\b/i);
  });
});
