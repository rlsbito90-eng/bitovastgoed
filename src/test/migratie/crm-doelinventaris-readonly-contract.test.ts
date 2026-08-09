import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sqlPath = path.join(process.cwd(), 'scripts', 'migratie', 'inventariseer-crm-doel.sql');
const sql = readFileSync(sqlPath, 'utf8');
const zonderComments = sql
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n');

describe('CRM doelinventaris read-only contract', () => {
  it('bevat alleen metadata-selectie en geen muterende SQL-statements', () => {
    expect(zonderComments.trimStart().toLowerCase()).toMatch(/^with\b/);
    expect(zonderComments.toLowerCase()).toContain('select jsonb_pretty');

    const verboden = [
      'insert', 'update', 'delete', 'merge', 'alter', 'create', 'drop',
      'truncate', 'grant', 'revoke', 'call', 'execute', 'copy', 'vacuum',
    ];

    for (const keyword of verboden) {
      expect(zonderComments).not.toMatch(new RegExp(`(^|[;\\n]\\s*)${keyword}\\b`, 'i'));
    }
  });

  it('markeert uitsluitend het eigen CRM-project als verwacht doel', () => {
    expect(sql).toContain("'target_expected_project_ref', 'vyjocdlwfxrblusfngfq'");
    expect(sql).not.toContain('ljudxyrqoifhfikueric');
    expect(sql).not.toContain('wzkhmjuasyuvzhhycnym');
    expect(sql).not.toContain('xfygspvpeugxowxbcvnm');
  });

  it('inventariseert de essentiële migratiecategorieën', () => {
    expect(sql).toContain("n.nspname = 'public'");
    expect(sql).toContain('pg_policies');
    expect(sql).toContain('information_schema.triggers');
    expect(sql).toContain('auth.users');
    expect(sql).toContain('storage.buckets');
    expect(sql).toContain('storage.objects');
    expect(sql).toContain('supabase_migrations.schema_migrations');
  });
});
