import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RECOVERED_MIGRATIONS = [
  ['20260809141031_crm_mig_contact_moments.sql', '27cb5e09825f31522daaed336337ad4b'],
  ['20260809141217_crm_mig_off_market_ai_fields.sql', '88b6a91304d7670f3deccf8e4c1b1c24'],
  ['20260809141258_crm_mig_off_market_bron_stats.sql', '2eba5b1efe9d20084e385aaf2f6a2b7a'],
] as const;

describe('CRM migration history recovery', () => {
  it.each(RECOVERED_MIGRATIONS)('%s is byte-exact gelijk aan de remote migration statement', (filename, expectedMd5) => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', filename));
    expect(createHash('md5').update(sql).digest('hex')).toBe(expectedMd5);
  });
});
