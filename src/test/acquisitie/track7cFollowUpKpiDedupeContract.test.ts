import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.resolve('supabase/migrations/20260816060500_acquisitie_followup_kpi_dedupe.sql'),
  'utf8',
);

describe('TRACK-7C follow-up KPI dedupe contract', () => {
  it('gebruikt metadata.taak_id als primaire stabiele opvolgingssleutel', () => {
    expect(migration).toContain("nullif(e.metadata->>'taak_id','')");
    expect(migration).toContain('e.brief_id::text');
    expect(migration).toContain("e.bronlog || ':' || e.bron_event_id");
  });

  it('dedupliceert aangemaakte en afgeronde opvolging op dezelfde sleutel', () => {
    expect(migration).toContain(
      "count(distinct b.opvolging_key) filter (where b.event_type='opvolging_aangemaakt') as opvolging_aangemaakt",
    );
    expect(migration).toContain(
      "count(distinct b.opvolging_key) filter (where b.event_type='opvolging_afgerond') as opvolging_afgerond",
    );
  });

  it('laat verzending, respons en Kadaster-KPI-logica intact', () => {
    expect(migration).toContain('count(distinct b.communicatie_key) filter (where b.telt_verzonden_communicatie)');
    expect(migration).toContain('count(distinct b.communicatie_key) filter (where b.telt_reactie)');
    expect(migration).toContain('count(*) filter (where b.telt_kadaster_aanvraag)');
  });
});
