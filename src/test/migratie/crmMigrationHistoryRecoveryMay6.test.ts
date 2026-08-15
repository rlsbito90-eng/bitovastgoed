import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CRM migration history recovery — final May 6 migration', () => {
  it('20260506185121_create_acquisitie_checkins.sql is byte-exact gelijk aan de remote migration statement', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260506185121_create_acquisitie_checkins.sql'));
    expect(createHash('md5').update(sql).digest('hex')).toBe('95c9dceb950005372c09d44cf90f9fcb');
  });
});
