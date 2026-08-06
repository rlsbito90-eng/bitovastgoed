import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { controleerProductiekernSchemaDekking } from './productiekernSchemaDekking';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
  ),
  'utf8',
);

describe('productiekern schema coverage', () => {
  it('herkent een volledig minimaal schema', () => {
    const volledigSql = `
      create table public.off_market_acquisitie_dossiers (
        selectie_id uuid, signaal_id uuid, primaire_werkbak text
      );
      create table public.off_market_productie_brieven (
        briefnummer text, actieve_versie integer
      );
      create table public.off_market_brief_versies (id uuid);
      create table public.off_market_printbatches (id uuid);
      create table public.off_market_printbatch_brieven (id uuid);
      create table public.off_market_batchdocumenten (id uuid);
      create table public.off_market_productie_events (id uuid);
      create table public.off_market_productie_nummerreeksen (id uuid);
    `;

    expect(controleerProductiekernSchemaDekking(volledigSql)).toEqual({
      aanwezig: [
        'acquisitiedossier',
        'briefkern',
        'briefversies',
        'printbatches',
        'batchbrieven',
        'batchdocumenten',
        'productieaudit',
        'nummerreeksen',
      ],
      ontbrekend: [],
      volledig: true,
    });
  });

  it('houdt het huidige SQL-concept fail-closed zolang dossier- en briefkern ontbreken', () => {
    const dekking = controleerProductiekernSchemaDekking(sql);

    expect(dekking.volledig).toBe(false);
    expect(dekking.ontbrekend).toEqual([
      'acquisitiedossier',
      'briefkern',
    ]);
    expect(dekking.aanwezig).toEqual([
      'briefversies',
      'printbatches',
      'batchbrieven',
      'batchdocumenten',
      'productieaudit',
      'nummerreeksen',
    ]);
  });

  it('accepteert losse kolomnamen niet als bewijs van een persistente kern', () => {
    const dekking = controleerProductiekernSchemaDekking(`
      -- selectie_id, signaal_id, primaire_werkbak
      -- briefnummer, actieve_versie
    `);

    expect(dekking.aanwezig).toEqual([]);
    expect(dekking.volledig).toBe(false);
  });
});
