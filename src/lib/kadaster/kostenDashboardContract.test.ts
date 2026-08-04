import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/KadasterKostenPage.tsx'), 'utf8');
const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useKadasterKostenbeheer.ts'), 'utf8');
const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260804152000_kadaster_kostenbeheer.sql'), 'utf8');

describe('Kadaster kostenbeheer dashboard', () => {
  it('biedt week-, maand- en jaaroverzicht met werkelijke kosten per product', () => {
    expect(page).toContain("'week','maand','jaar'");
    expect(page).toContain('Werkelijke kosten');
    expect(page).toContain('Producten in deze periode');
    expect(page).toContain('Laatste aanvragen');
    expect(hook).toContain("['geleverd', 'gedeeltelijk_geleverd']");
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
    expect(app).toContain('import KadasterKostenPage');
    expect(app).toContain('/rapportage/kadasterkosten');
  });
});
