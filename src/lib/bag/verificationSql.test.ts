import { describe, expect, it } from 'vitest';
import { bouwAmsterdamShadowValidatieSql } from './verificationSql';

describe('Amsterdam shadowvalidatie-SQL', () => {
  it('bouwt alle vier validatieblokken voor scope 0363', () => {
    const bundel = bouwAmsterdamShadowValidatieSql({ scopeCode: '0363', datasetVersie: "0363:2026-08-04:abc'def" });
    expect(Object.keys(bundel)).toEqual(['preflight', 'integriteit', 'publicatiepoort', 'rollbackControle']);
    expect(bundel.integriteit).toContain("scope_code = '0363'");
    expect(bundel.publicatiepoort).toContain("0363:2026-08-04:abc''def");
  });

  it('bevat alleen read-only select-statements', () => {
    const bundel = bouwAmsterdamShadowValidatieSql({ scopeCode: '0363', datasetVersie: 'v1' });
    const sql = Object.values(bundel).join('\n').toLowerCase();
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create)\b/);
  });
});
