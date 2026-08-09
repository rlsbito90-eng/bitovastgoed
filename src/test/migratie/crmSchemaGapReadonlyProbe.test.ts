import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const probePath = path.resolve(process.cwd(), 'scripts/migratie/crm-schema-gap-readonly.sql');
const sql = readFileSync(probePath, 'utf8');
const genormaliseerd = sql
  .replace(/--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .toLowerCase();

describe('CRM schema-gap read-only probe', () => {
  it('bevat uitsluitend SELECT-statements als top-level SQL', () => {
    const statements = genormaliseerd
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement.startsWith('select')).toBe(true);
    }
  });

  it('bevat geen muterende SQL-keywords', () => {
    expect(genormaliseerd).not.toMatch(/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|call|do)\b/);
  });

  it('inventariseert de migratiehistorie zonder deze te wijzigen', () => {
    expect(genormaliseerd).toContain('from supabase_migrations.schema_migrations');
  });
});
