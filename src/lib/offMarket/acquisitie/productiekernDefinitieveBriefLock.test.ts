import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pad = resolve(
  process.cwd(),
  'supabase/migrations/20260816215000_acquisitie_productiekern_definitieve_brief_lock.sql',
);
const sql = readFileSync(pad, 'utf8');

describe('Productiekern definitieve brief lock', () => {
  it('blokkeert iedere wijziging zodra OLD.status definitief is', () => {
    expect(sql).toMatch(/if old\.status = 'definitief' and new is distinct from old/i);
    expect(sql).toContain('brief_definitief_vergrendeld');
    expect(sql).toMatch(/before update on public\.off_market_brieven/i);
  });

  it('geeft de triggerfunctie geen client execute-rechten', () => {
    expect(sql).toMatch(/revoke all on function public\.off_market_bewaak_definitieve_brief_lock\(\)[\s\S]*from public, anon, authenticated/i);
    expect(sql).not.toMatch(/grant\s+/i);
  });
});
