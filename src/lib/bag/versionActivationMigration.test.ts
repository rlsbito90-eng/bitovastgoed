import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const normaliseer = (pad: string) =>
  readFileSync(resolve(process.cwd(), pad), 'utf-8')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const migration = normaliseer(
  'supabase/migration-archive/pre-baseline-snapshot/20260803190000_bag_2a6_version_activation.sql',
);
const probe = normaliseer(
  'experiments/bag/2a6/version-activation-shadow-probe.sql',
);

describe('BAG 2A.6 versieactivatie', () => {
  it('serialiseert activatie per scope en vergrendelt de versierijen', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('hashtextextended(v_scope_code, 0)');
    expect(migration).toContain('order by d.id for update');
  });

  it('blokkeert activatie zonder volledige staging/published-pariteit', () => {
    expect(migration).toContain("v_status <> 'gevalideerd'");
    expect(migration).toContain('v_staging_objecten = 0');
    expect(migration).toContain('v_staging_objecten <> v_published_objecten');
    expect(migration).toContain('v_staging_geometrieen <> v_published_geometrieen');
    expect(migration).toContain('staging/published-pariteit faalt');
  });

  it('houdt exact één actieve versie en bewaart de voorganger', () => {
    expect(migration).toContain("set status = 'vervangen', is_actief = false");
    expect(migration).toContain("set status = 'actief', is_actief = true");
    expect(migration).toContain('v_vorige_datasetversie_id');
  });

  it('staat rollback alleen toe voor een expliciet geldig versiepaar', () => {
    expect(migration).toContain('v_scope_code <> v_vorige_scope_code');
    expect(migration).toContain("v_huidige_status <> 'actief'");
    expect(migration).toContain("v_vorige_status <> 'vervangen'");
    expect(migration).toContain('rollbackpaar ongeldig');
  });

  it('sluit app-rollen uit en geeft uitsluitend publisher execute', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain(
      'revoke all on function bag_control.activeer_datasetversie(bigint) from public, anon, authenticated, service_role',
    );
    expect(migration).toContain(
      'grant execute on function bag_control.activeer_datasetversie(bigint) to bag_publisher',
    );
  });

  it('bewijst A naar B en gecontroleerde rollback naar A transactioneel', () => {
    expect(probe).toContain('activeer_datasetversie(900000061)');
    expect(probe).toContain('activeer_datasetversie(900000062)');
    expect(probe).toContain('rollback_datasetversie(900000062, 900000061)');
    expect(probe).toContain('rollback;');
    expect(probe).not.toContain('commit;');
    expect(probe).toContain('2a.6_version_activation_rollback_ok');
  });
});
