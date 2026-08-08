import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function leesDraft(bestand: string): string {
  return readFileSync(resolve(process.cwd(), 'supabase/migration-drafts', bestand), 'utf8');
}

function laatsteUitvoerbareStatement(sql: string): string {
  const zonderRegelcommentaar = sql
    .split('\n')
    .map((regel) => regel.replace(/--.*$/, ''))
    .join('\n')
    .trim();
  const statements = zonderRegelcommentaar
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  return statements.at(-1) ?? '';
}

const basis = leesDraft('20260806_acquisitie_productiekern_build_a.sql');
const dossierBriefkern = leesDraft(
  '20260806_acquisitie_productiekern_dossier_briefkern.sql',
);
const functies = leesDraft(
  '20260806_acquisitie_productiekern_transactionele_functies.sql',
);
const gezamenlijk = `${basis}\n${dossierBriefkern}`;

describe('samenhang productiekern SQL-concepten', () => {
  it('definieert iedere tabel die de transactionele functies gebruiken', () => {
    const gebruikteTabellen = [
      'off_market_brieven',
      'off_market_brief_versies',
      'off_market_printbatches',
      'off_market_printbatch_brieven',
      'off_market_batchdocumenten',
      'off_market_productie_events',
    ];

    for (const tabel of gebruikteTabellen) {
      const bestaatInConcept =
        new RegExp(`create\\s+table[^;]*public\\.${tabel}\\b`, 'i').test(gezamenlijk)
        || new RegExp(`alter\\s+table[^;]*public\\.${tabel}\\b`, 'i').test(gezamenlijk);
      expect(existsInConcept(tabel, bestaatInConcept)).toBe(true);
    }
  });

  it('definieert alle briefvelden die de definitief- en postfuncties muteren', () => {
    for (const kolom of [
      'briefnummer',
      'definitief_op',
      'vergrendeld_op',
    ]) {
      expect(dossierBriefkern).toMatch(
        new RegExp(`add column if not exists ${kolom}\\b`, 'i'),
      );
      expect(functies).toMatch(new RegExp(`\\b${kolom}\\b`, 'i'));
    }
  });

  it('definieert nummerfuncties vóór de transactionele functies daarvan afhankelijk zijn', () => {
    expect(basis).toContain('function public.reserveer_off_market_briefnummer');
    expect(basis).toContain('function public.reserveer_off_market_batchnummer');
    expect(functies).toContain('public.reserveer_off_market_briefnummer(p_jaar)');
  });

  it('houdt alle drie concepten niet-toegepast en rollback-only', () => {
    for (const sql of [basis, dossierBriefkern, functies]) {
      expect(sql).toContain('NIET AUTOMATISCH TOEPASSEN');
      expect(laatsteUitvoerbareStatement(sql).toLowerCase()).toBe('rollback');
    }
  });
});

function existsInConcept(tabel: string, bestaat: boolean): boolean {
  if (!bestaat) {
    throw new Error(`SQL-concept definieert gebruikte tabel ${tabel} niet.`);
  }
  return true;
}
