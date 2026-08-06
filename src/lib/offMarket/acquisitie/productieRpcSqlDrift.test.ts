import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql',
), 'utf8');

const rpcContract = readFileSync(resolve(
  process.cwd(),
  'src/lib/offMarket/acquisitie/productieRpcContract.ts',
), 'utf8');

const VERWACHTE_RPC_CONTRACTEN = {
  off_market_brief_definitief_maken: [
    'p_brief_id',
    'p_brief_versie_id',
    'p_actor_id',
    'p_operation_key',
    'p_verwacht_versienummer',
    'p_uitgevoerd_op',
    'p_jaar',
  ],
  off_market_batch_documenten_registreren: [
    'p_batch_id',
    'p_actor_id',
    'p_operation_key',
    'p_verwacht_documentversie',
    'p_uitgevoerd_op',
    'p_documenten',
  ],
  off_market_batch_geprint_markeren: [
    'p_batch_id',
    'p_actor_id',
    'p_operation_key',
    'p_verwacht_documentversie',
    'p_printdatum',
  ],
  off_market_brief_gepost_markeren: [
    'p_brief_id',
    'p_brief_versie_id',
    'p_batch_id',
    'p_geadresseerde_key',
    'p_actor_id',
    'p_operation_key',
    'p_verwacht_versienummer',
    'p_verzenddatum',
  ],
} as const;

function sqlParameters(functienaam: string): string[] {
  const match = sql.match(new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functienaam}\\s*\\(([\\s\\S]*?)\\)\\s*returns`,
    'i',
  ));
  if (!match) throw new Error(`SQL-functie ontbreekt: ${functienaam}`);

  return match[1]
    .split(',')
    .map(regel => regel.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function tsParameters(functienaam: string): string[] {
  const rpcStart = rpcContract.indexOf(`rpc: '${functienaam}'`);
  if (rpcStart < 0) throw new Error(`RPC-naam ontbreekt in TypeScript: ${functienaam}`);
  const parametersStart = rpcContract.indexOf('parameters: {', rpcStart);
  const parametersEnd = rpcContract.indexOf('\n    },', parametersStart);
  const blok = rpcContract.slice(parametersStart, parametersEnd);

  return Array.from(blok.matchAll(/\b(p_[a-z0-9_]+)\s*:/g), match => match[1]);
}

describe('productie RPC ↔ SQL drift', () => {
  for (const [functienaam, parameters] of Object.entries(VERWACHTE_RPC_CONTRACTEN)) {
    it(`${functienaam} houdt naam en parameterlijst exact gelijk`, () => {
      expect(sqlParameters(functienaam)).toEqual(parameters);
      expect(tsParameters(functienaam)).toEqual(parameters);
    });
  }

  it('bevat geen oude of alternatieve RPC-namen', () => {
    expect(rpcContract).not.toContain("'maak_off_market_brief_definitief'");
    expect(rpcContract).not.toContain("'registreer_off_market_batchdocumenten'");
    expect(rpcContract).not.toContain("'markeer_off_market_batch_geprint'");
    expect(rpcContract).not.toContain("'markeer_off_market_brief_gepost'");
  });

  it('laat de database het BR-nummer atomisch reserveren', () => {
    expect(rpcContract).toContain('p_jaar: input.jaar');
    expect(rpcContract).not.toContain('p_gereserveerd_briefnummer');
    expect(sql).toContain('public.reserveer_off_market_briefnummer(p_jaar)');
  });
});
