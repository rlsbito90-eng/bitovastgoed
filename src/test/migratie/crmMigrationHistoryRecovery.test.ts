import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RECOVERED_MIGRATIONS = [
  ['20260809135458_crm_mig_2c3_classificatie_schema.sql', '856d242af8b0224ba24259f425926c27'],
  ['20260809140859_crm_mig_pipeline_fundament.sql', '72ea7f0e19393e55db557146b6847c8c'],
  ['20260809141031_crm_mig_contact_moments.sql', '27cb5e09825f31522daaed336337ad4b'],
  ['20260809141119_crm_mig_off_market_core.sql', 'f09bd42b41302511e7d5ae8a52360fd6'],
  ['20260809141217_crm_mig_off_market_ai_fields.sql', '88b6a91304d7670f3deccf8e4c1b1c24'],
  ['20260809141244_crm_mig_off_market_sources_seed.sql', 'fcf67eb5b6d99c48db17affa1480cfed'],
  ['20260809141258_crm_mig_off_market_bron_stats.sql', '2eba5b1efe9d20084e385aaf2f6a2b7a'],
  ['20260809141337_crm_mig_off_market_enrichment_fields.sql', 'b05e9e47e8226f685230de51c0a11b16'],
  ['20260809141459_crm_mig_off_market_import_contract.sql', '798ab1ee635c0882983492bd3a4db96a'],
  ['20260809141552_crm_mig_off_market_brief_acquisitie.sql', '5f205742756bebff24a1b98e19fc54f2'],
  ['20260809141657_crm_mig_off_market_promote_rpc.sql', '77f73110632b8839ac0fb847aa9c1906'],
] as const;

describe('CRM migration history recovery', () => {
  it.each(RECOVERED_MIGRATIONS)('%s is byte-exact gelijk aan de remote migration statement', (filename, expectedMd5) => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', filename));
    expect(createHash('md5').update(sql).digest('hex')).toBe(expectedMd5);
  });
});
