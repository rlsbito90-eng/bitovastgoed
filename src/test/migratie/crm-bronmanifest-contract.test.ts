import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CRM bronmanifest contract', () => {
  it('blijft lokaal, deterministisch en read-only', () => {
    const file = path.join(process.cwd(), 'scripts', 'migratie', 'inventariseer-crm-bron.mjs');
    const source = readFileSync(file, 'utf8');

    expect(source).toContain("supabase', 'migrations");
    expect(source).toContain("supabase', 'functions");
    expect(source).toContain("createHash('sha256')");
    expect(source).toContain('JSON.stringify(manifest, null, 2)');

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain('createClient(');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('writeFile');
    expect(source).not.toContain('rm(');
    expect(source).not.toContain('unlink(');
  });
});
