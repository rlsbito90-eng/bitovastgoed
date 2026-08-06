import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { controleerProductiekernSchemaDekking } from './productiekernSchemaDekking';

const basisSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
  ),
  'utf8',
);

const dossierBriefkernSql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql',
  ),
  'utf8',
);

const gezamenlijkSql = `${basisSql}\n${dossierBriefkernSql}`;

describe('productiekern schema coverage', () => {
  it('herkent een volledig minimaal schema', () => {
    const volledigSql = `
      create table public.off_market_acquisitie_dossiers (
        selectie_id uuid, signaal_id uuid, primaire_werkbak text
      );
      alter table public.off_market_brieven
        add column briefnummer text,
        add column selectie_id uuid,
        add column actieve_versie integer,
        add column definitief_op timestamptz,
        add column vergrendeld_op timestamptz;
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

  it('toont dat het oorspronkelijke basisconcept dossier- en briefkern miste', () => {
    const dekking = controleerProductiekernSchemaDekking(basisSql);

    expect(dekking.volledig).toBe(false);
    expect(dekking.ontbrekend).toEqual([
      'acquisitiedossier',
      'briefkern',
    ]);
  });

  it('bevestigt volledige minimale dekking over de gezamenlijke niet-toegepaste drafts', () => {
    const dekking = controleerProductiekernSchemaDekking(gezamenlijkSql);

    expect(dekking.volledig).toBe(true);
    expect(dekking.ontbrekend).toEqual([]);
    expect(dekking.aanwezig).toHaveLength(8);
  });

  it('accepteert losse kolomnamen niet als bewijs van een persistente kern', () => {
    const dekking = controleerProductiekernSchemaDekking(`
      -- selectie_id, signaal_id, primaire_werkbak
      -- briefnummer, actieve_versie, definitief_op, vergrendeld_op
    `);

    expect(dekking.aanwezig).toEqual([]);
    expect(dekking.volledig).toBe(false);
  });
});
