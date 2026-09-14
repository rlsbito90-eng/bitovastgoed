import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260914084010_allow_canonical_batch_post_projection.sql',
), 'utf8');

describe('definitieve brief-lock bij atomisch posten', () => {
  it('laat alleen de volledige operationele gepost-projectie door', () => {
    expect(sql).toContain("new.status = 'verstuurd'");
    expect(sql).toContain("new.verzendstatus = 'gepost'");
    expect(sql).toContain('new.opvolgdatum = new.postdatum + 21');
    expect(sql).toContain("bv.status = 'verzonden'");
    expect(sql).toContain("batch.status = 'geprint'");
  });

  it('sluit inhoudelijke wijzigingen uit en behoudt de definitieve lock', () => {
    expect(sql).toContain("to_jsonb(new) - array[");
    expect(sql).toContain("'status', 'verzendstatus', 'printdatum', 'postdatum'");
    expect(sql).toContain("raise exception 'brief_definitief_vergrendeld'");
    expect(sql).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i);
  });
});
