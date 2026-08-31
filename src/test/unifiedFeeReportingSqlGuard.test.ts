import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260831153000_guard_fee_reporting_legacy_ambiguity.sql'),
  'utf8',
);

const legacyBackfillMigration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260831154500_backfill_object_fee_forecast_from_legacy_deal.sql'),
  'utf8',
);

describe('object_fee_reporting SQL guard', () => {
  it('gebruikt accepted bid als sterkste concrete Deal-identificatie', () => {
    expect(migration).toContain('accepted_active_deal');
    expect(migration).toContain("b.status = 'geaccepteerd'");
  });

  it('staat legacy fallback alleen toe bij exact één actieve Deal', () => {
    expect(migration).toContain('active_count = 1');
    expect(migration).toContain('single_active_deal');
  });

  it('valt bij ambiguïteit terug op Objectforecast in plaats van willekeurige Dealfee', () => {
    expect(migration).toContain('else null');
    expect(migration).toContain('coalesce(c.verwachte_fee_bedrag, 0)');
    expect(migration).not.toContain('row_number() over');
  });

  it('backfillt oude fee alleen voor één actieve Deal vóór de transactiedrempel', () => {
    expect(legacyBackfillMigration).toContain('adc.active_count = 1');
    expect(legacyBackfillMigration).toContain('oc.current_stage_order < oc.preferred_stage_order');
    expect(legacyBackfillMigration).toContain('oc.verwachte_fee_bedrag is null');
    expect(legacyBackfillMigration).toContain('d.commissie_bedrag is not null');
  });

  it('kopieert bestaande fee naar Objectforecast zonder een concrete Deal af te leiden', () => {
    expect(legacyBackfillMigration).toContain('verwachte_fee_bedrag = e.commissie_bedrag::numeric');
    expect(legacyBackfillMigration).toContain('verwachte_fee_pct = coalesce(o.verwachte_fee_pct, e.commissie_pct)');
    expect(legacyBackfillMigration).toContain('verwachte_fee_structuur = coalesce(o.verwachte_fee_structuur, e.fee_structuur)');
    expect(legacyBackfillMigration).not.toContain("fase = 'afgerond'");
    expect(legacyBackfillMigration).not.toContain("status = 'geaccepteerd'");
  });
});
