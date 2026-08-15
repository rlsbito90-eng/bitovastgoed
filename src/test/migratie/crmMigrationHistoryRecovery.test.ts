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
  ['20260809194328_crm_mig_build_1a_safe_additive_enums.sql', 'c399a3cce033f522224c038ff452918e'],
  ['20260809194418_crm_mig_build_1b_object_status_canonical.sql', 'ef19bbefb86152a4ae2efaeed783c964'],
  ['20260809194513_crm_mig_build_1c_safe_core_deltas.sql', '790caf91d0426fdaf4e9e4b111f0bbd4'],
  ['20260809194556_crm_mig_build_1d1_objecten_canonical_preimport.sql', '0c25f0d31abca99c2cb8ac37bc77ab44'],
  ['20260809194624_crm_mig_build_2_object_identity.sql', '7c75109b10c1c3ac08a38ed295e88a9c'],
  ['20260809194645_crm_mig_build_5_kadaster_cost_governance.sql', '07e7648d1e007c3afa9e8cf396713f6b'],
  ['20260809194724_crm_mig_build_4_acquisition_vastgoedkansen.sql', 'b85e9c51ea4df4beebcf359bc527c77f'],
  ['20260809195218_crm_mig_build3_vastgoedrekenen_base.sql', 'd8369b561e73f5c900bda7ff4cf4670f'],
  ['20260809195246_crm_mig_build3_vastgoedrekenen_may_delta.sql', '70923f4e381e42606ad0b43b4e9a3d92'],
  ['20260809195330_crm_mig_build3_kengetallen_acquisition.sql', 'c5d86980e5f15a28ce5300d07d4815c8'],
  ['20260809195354_crm_mig_build3_valuation_extensions.sql', '61e9133aec8c37397baa043c5f357609'],
  ['20260809195418_crm_mig_build3_financing.sql', '656a4a0baf340e85fbfd219ca48272c2'],
  ['20260809195506_crm_mig_build3_taxonomy_area_preferences.sql', 'fe4c971fa902373fb561ac26c7a4bccd'],
  ['20260809195530_crm_mig_build3_scenario_profiles.sql', '85daf9a9bc431075470a24618f817634'],
  ['20260809195619_crm_mig_build3_source_governance_tables.sql', 'c64c334536f16a8d65a93de0d6594aba'],
  ['20260809195725_crm_mig_build6_remaining_core_tables.sql', 'a77031413ef5802b3439e96a8937a2e1'],
  ['20260809195756_crm_mig_build3_taxonomy_timing_dcf.sql', '91091c03f677d67e1b3708f7b4780ac4'],
] as const;

describe('CRM migration history recovery', () => {
  it.each(RECOVERED_MIGRATIONS)('%s is byte-exact gelijk aan de remote migration statement', (filename, expectedMd5) => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', filename));
    expect(createHash('md5').update(sql).digest('hex')).toBe(expectedMd5);
  });
});
