import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERPLICHTE_CENTRALE_BAG_CONTROLES } from './centralPreflight';

const script = readFileSync(
  resolve(process.cwd(), 'scripts/bag/run-2a8-central-preflight.sh'),
  'utf8',
);
const sql = readFileSync(
  resolve(process.cwd(), 'experiments/bag/2a8/central-preflight.sql'),
  'utf8',
);

describe('BAG 2A.8 centrale preflight', () => {
  it('is read-only, begrensd en niet afhankelijk van gebruikers-psql-configuratie', () => {
    expect(sql).toContain('BEGIN TRANSACTION READ ONLY;');
    expect(sql).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/gm);
    expect(script).toContain("statement_timeout=30000");
    expect(script).toContain("lock_timeout=5000");
    expect(script).toContain('psql "$BAG_SHADOW_DATABASE_URL" -X');
  });

  it('bindt doelref, omgeving, TLS en bekende productie-denylijst vóór psql', () => {
    const psqlPositie = script.indexOf('psql "$BAG_SHADOW_DATABASE_URL"');
    for (const fragment of [
      'BAG_EXPECTED_SHADOW_PROJECT_REF',
      "BAG_SHADOW_ENVIRONMENT\" == 'shadow'",
      'sslmode=require',
      'ljudxyrqoifhfikueric',
      'Het doel staat op de productie-denylijst.',
    ]) {
      expect(script.indexOf(fragment)).toBeGreaterThan(-1);
      expect(script.indexOf(fragment)).toBeLessThan(psqlPositie);
    }
  });

  it('dekt iedere verplichte centrale controle in SQL', () => {
    for (const controle of VERPLICHTE_CENTRALE_BAG_CONTROLES) {
      expect(sql).toContain(`'${controle}'`);
    }
  });

  it('ondersteunt lege shadow en actieve release als afzonderlijke gates', () => {
    expect(script).toContain("'clean-shadow'");
    expect(script).toContain("'active-dataset'");
    expect(sql).toContain("WHEN 'clean-shadow'");
    expect(sql).toContain("WHEN 'active-dataset'");
    expect(sql).toContain('active_parity');
  });

  it('schrijft een controleerbaar rapport zonder database-URL of geheim', () => {
    expect(script).toContain('2a8-report.json');
    const reportBlok = script.slice(script.indexOf("REPORT_PROJECT_REF="));
    expect(reportBlok).not.toContain('BAG_SHADOW_DATABASE_URL');
    expect(reportBlok).not.toContain('password');
    expect(reportBlok).not.toContain('databaseHost');
  });
});
