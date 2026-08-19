import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/SnellePandcheckPage.tsx'), 'utf8');
const crmApp = readFileSync(resolve(process.cwd(), 'src/CrmProtectedApp.tsx'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260804150000_crm_objectidentiteit.sql'), 'utf8');

describe('Snelle pandcheck', () => {
  it('controleert CRM-breed zonder automatische opslag', () => {
    expect(page).toContain('controleerObjectCrmBreed');
    expect(page).toContain('useVastgoedkansen');
    expect(page).toContain('useOffMarketSignalenAlle');
    expect(page).toContain('useDataStore');
    expect(page).toContain('Er wordt niets automatisch opgeslagen.');
    expect(page).not.toContain('insert(');
    expect(page).not.toContain('addKans(');
  });

  it('heeft een beveiligde route binnen de bestaande app', () => {
    expect(crmApp).toContain('SnellePandcheckPage');
    expect(crmApp).toContain('/vastgoedkansen/pandcheck');
  });
});

describe('CRM-objectidentiteit', () => {
  it('legt objectregistratie en unieke bronkoppelingen vast', () => {
    expect(migration).toContain('create table if not exists public.crm_objectregistraties');
    expect(migration).toContain('create table if not exists public.crm_objectbronkoppelingen');
    expect(migration).toContain('unique (bron_type, bron_id)');
    expect(migration).toContain('bag_verblijfsobject_id');
    expect(migration).toContain('bag_pand_id');
    expect(migration).toContain('adres_sleutel');
  });

  it('activeert RLS en bevat geen Kadaster-API of betaalactie', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).not.toMatch(/api[_ -]?key|contractloos|betaal/i);
  });
});
