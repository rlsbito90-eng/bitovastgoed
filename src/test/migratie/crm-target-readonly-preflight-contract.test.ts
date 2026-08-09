import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sqlPath = resolve(process.cwd(), 'scripts/migratie/crm-target-readonly-preflight.sql');
const sql = readFileSync(sqlPath, 'utf8');

describe('CRM target read-only preflight contract', () => {
  it('opent expliciet een read-only transactie en eindigt met rollback', () => {
    expect(sql).toMatch(/BEGIN\s+TRANSACTION\s+READ\s+ONLY\s*;/i);
    expect(sql.trim()).toMatch(/ROLLBACK\s*;$/i);
  });

  it('bevat geen muterende of uitvoerende SQL-statements', () => {
    const zonderCommentaar = sql
      .split('\n')
      .filter(line => !line.trimStart().startsWith('--'))
      .join('\n');

    const verbodenStatement = /^\s*(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO|VACUUM|REFRESH|REINDEX|CLUSTER|COPY)\b/im;
    expect(zonderCommentaar).not.toMatch(verbodenStatement);
  });

  it('controleert de kritieke migratievlakken zonder persoonsgegevens uit te lezen', () => {
    expect(sql).toContain("to_regclass('public.off_market_signalen')");
    expect(sql).toContain("to_regclass('public.off_market_acquisitie_dossiers')");
    expect(sql).toContain('FROM auth.users');
    expect(sql).toContain('FROM storage.buckets');
    expect(sql).toContain("n.nspname = 'public'");
    expect(sql).not.toMatch(/SELECT\s+\*\s+FROM\s+auth\.users/i);
    expect(sql).not.toMatch(/SELECT\s+\*\s+FROM\s+storage\.objects/i);
  });
});
