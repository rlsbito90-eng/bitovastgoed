import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/KadasterKostenPage.tsx'), 'utf8');
const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useKadasterKostenbeheer.ts'), 'utf8');
const crmApp = readFileSync(resolve(process.cwd(), 'src/CrmProtectedApp.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260804152000_kadaster_kostenbeheer.sql'), 'utf8');

describe('Kadaster kostenbeheer dashboard', () => {
  it('biedt week-, maand- en jaaroverzicht met werkelijke kosten per product', () => {
    expect(page).toContain("'week','maand','jaar'");
    expect(page).toContain('Werkelijke kosten');
    expect(page).toContain('Producten in deze periode');
    expect(page).toContain('Laatste aanvragen');
    expect(hook).toContain("['geleverd', 'gedeeltelijk_geleverd']");
  });

  it('is app-breed en rapporteert de herkomst per CRM-module', () => {
    expect(migration).toContain('bron_module text not null');
    expect(migration).toContain("'vastgoedkansen','off_market_radar','objecten','acquisitie','deals','pandenverkenner','snelle_pandcheck'");
    expect(migration).toContain("scope_type in ('bedrijf','gebruiker','campagne','module')");
    expect(hook).toContain('perModule');
    expect(hook).toContain('slaModulebudgetOp');
    expect(page).toContain('Kosten per module');
    expect(page).toContain('Eén centrale kostenlaag');
    expect(page).toContain('App-breed bedrijfsbudget');
  });

  it('laat alleen beheerders budgetten en producten wijzigen', () => {
    expect(page).toContain('const { isAdmin } = useAuth()');
    expect(page).toContain('disabled={!isAdmin}');
    expect(page).toContain('Alleen een beheerder kan budgetten wijzigen.');
  });

  it('maakt kosten-events browser-read-only en doet geen Kadaster-call', () => {
    expect(migration).toContain('Browserrollen krijgen bewust geen INSERT/UPDATE/DELETE-policy');
    expect(migration).not.toMatch(/api[-_ ]?key|authorization:|kadaster\.nl\/api/i);
    expect(hook).not.toContain("from('kadaster_kosten_events').insert");
    expect(hook).not.toContain("from('kadaster_kosten_events').update");
  });

  it('is bereikbaar via een afzonderlijke rapportageroute', () => {
    expect(crmApp).toMatch(/const\s+KadasterKostenPage\s*=\s*lazy\(\(\)\s*=>\s*import\(["']@\/pages\/KadasterKostenPage["']\)\)/);
    expect(crmApp).toContain('/rapportage/kadasterkosten');
  });
});