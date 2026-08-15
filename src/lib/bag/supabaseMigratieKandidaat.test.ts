import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIEPAD =
  'supabase/migration-archive/pre-baseline-snapshot/20260803143000_bag_2a3b_private_schema_candidate.sql';
const sqlBron = readFileSync(resolve(process.cwd(), MIGRATIEPAD), 'utf-8');
const sql = sqlBron.replace(/\s+/g, ' ').trim().toLowerCase();

const tabellen = [
  'bag_control.datasetversies',
  'bag_control.geometrie_afwijkingen',
  'bag_staging.objecten',
  'bag_staging.voorkomens',
  'bag_staging.relaties',
  'bag_staging.geometrieen',
  'bag_published.objecten',
  'bag_published.voorkomens',
  'bag_published.relaties',
  'bag_published.geometrieen',
] as const;

describe('BAG 2A.3B lokale Supabase-migratiekandidaat', () => {
  it('is één transactionele kandidaat met uitsluitend private BAG-schema’s', () => {
    expect(sql.startsWith('-- bag build 2a.3b')).toBe(true);
    expect(sql).toContain('begin;');
    expect(sql.endsWith('commit;')).toBe(true);
    expect(sql).toContain('create schema bag_control authorization postgres');
    expect(sql).toContain('create schema bag_staging authorization postgres');
    expect(sql).toContain('create schema bag_published authorization postgres');

    for (const tabel of tabellen) {
      expect(sql).toContain(`create table ${tabel}`);
    }
  });

  it('wijzigt public, CRM, Auth, Storage en Edge Functions niet', () => {
    expect(sql).not.toMatch(/(?:create|alter|drop|truncate|insert into|update|delete from)\s+(?:table\s+)?public\./);
    for (const crmObject of [
      'public.objecten',
      'public.deals',
      'public.vastgoedkansen',
      'public.off_market_signalen',
    ]) {
      expect(sql).not.toContain(crmObject);
    }
    expect(sqlBron).not.toContain('auth.');
    expect(sqlBron).not.toContain('storage.');
    expect(sqlBron).not.toContain('ljudxyrqoifhfikueric');
  });

  it('neemt het canonieke voorkomen- en geometriecontract exact over', () => {
    expect(sql).toContain(
      'primary key (datasetversie_id, objecttype, identificatie, voorkomen_sleutel)',
    );
    expect(sql).toContain(
      'datasetversie_id, objecttype, identificatie, voorkomen_sleutel, geometrie_volgnummer',
    );
    expect(sql).toContain('voorkomenidentificatie integer not null');
    expect(sql).toContain('geometrie extensions.geometry(geometryz, 28992) not null');
    expect(sql).toContain('check (extensions.st_srid(geometrie) = 28992)');
    expect(sql).toContain('check (extensions.st_ndims(geometrie) = 3)');
    expect(sql).toContain(
      "check (extensions.geometrytype(geometrie) in ('point', 'polygon'))",
    );
    expect(sql).toContain('using gist (geometrie)');
    expect(sql).not.toContain('st_makevalid');
  });

  it('bewaart versies en quarantaine zonder stille overschrijving', () => {
    expect(sql).toContain('unique (datasetversie, scope_code)');
    expect(sql).toContain('where is_actief');
    expect(sql).toContain("check (not is_actief or status = 'actief')");
    expect(sql).toContain('bron_checksum_algoritme text not null default \'sha256\'');
    expect(sql).toContain('wkt text');
    expect(sql).toContain('bronmetadata jsonb not null');
    expect(sql).not.toMatch(/on conflict[\s\S]*do update/);
  });

  it('sluit standaard- en applicatierollen af en creëert alleen NOLOGIN-rollen', () => {
    for (const rol of ['bag_loader', 'bag_publisher', 'bag_reader']) {
      expect(sql).toContain(`create role ${rol} nologin`);
    }
    expect(sql).toContain(
      'revoke all on schema bag_control, bag_staging, bag_published from public, anon, authenticated, service_role',
    );
    expect(sql).not.toMatch(/grant [^;]+ to (?:anon|authenticated|service_role)/);
    expect(sql).not.toMatch(/grant [^;]+ on [^;]*public\./);
  });

  it('geeft uitsluitend de BAG-rollen toegang tot het private PostGIS-schema', () => {
    expect(sql).toContain(
      'grant usage on schema extensions to bag_loader, bag_publisher, bag_reader',
    );
    expect(sql).not.toMatch(
      /grant usage on schema extensions to (?:anon|authenticated|service_role)/,
    );
  });

  it('forceert RLS op alle tien tabellen zonder policies voor app-rollen', () => {
    for (const tabel of tabellen) {
      expect(sql).toContain(`alter table ${tabel} enable row level security`);
      expect(sql).toContain(`alter table ${tabel} force row level security`);
    }
    expect(sql).not.toMatch(/create policy [^;]+ to (?:anon|authenticated|service_role)/);
    expect(sql).toContain('to bag_loader');
    expect(sql).toContain('to bag_publisher');
    expect(sql).toContain('to bag_reader');
  });

  it('geeft de reader uitsluitend actieve published-versies', () => {
    expect(sql).toContain('grant select on all tables in schema bag_published to bag_reader');
    expect(sql).toContain("d.is_actief and d.status = 'actief'");
    expect(sql).not.toContain('grant usage on schema bag_staging to bag_reader');
  });
});
