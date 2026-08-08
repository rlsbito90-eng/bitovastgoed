import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const manifest = fs.readFileSync(
  path.resolve('supabase/migration-drafts/20260808_acquisitie_productiekern_release_manifest.md'),
  'utf8',
);

const migratieVolgorde = [
  '20260806_acquisitie_productiekern_build_a.sql',
  '20260806_acquisitie_productiekern_dossier_briefkern.sql',
  '20260808_acquisitie_productiekern_vroege_transactionele_functies.sql',
  '20260806_acquisitie_productiekern_transactionele_functies.sql',
  '20260808_acquisitie_productiekern_security_wrappers.sql',
] as const;

const activatie = '20260808_acquisitie_productiekern_activatie_security.sql';

describe('Acquisitieproductiekern releasemanifest', () => {
  it('legt de bewezen structuur- en functievolgorde deterministisch vast', () => {
    const posities = migratieVolgorde.map((bestand) => manifest.indexOf(`\`${bestand}\``));
    expect(posities.every((positie) => positie >= 0)).toBe(true);
    expect(posities).toEqual([...posities].sort((a, b) => a - b));
  });

  it('houdt activatie-security expliciet buiten hetzelfde migratiepakket', () => {
    expect(manifest).toContain('## Niet opnemen in hetzelfde migratiepakket');
    expect(manifest).toContain(`\`${activatie}\``);
    expect(manifest).toContain('afzonderlijke activatiepoort');
  });

  it('verbiedt mechanische rollbackverwijdering en stilzwijgende backfill', () => {
    expect(manifest).toContain('verwijder nooit alleen mechanisch de afsluitende `ROLLBACK`');
    expect(manifest).toContain('introduceer geen backfill in hetzelfde pakket');
  });

  it('houdt productie expliciet no-go', () => {
    expect(manifest).toContain('**NO-GO:** uitvoerbare productiemigratie');
  });
});
