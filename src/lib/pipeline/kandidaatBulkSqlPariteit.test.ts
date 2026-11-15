import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {
  KANDIDAAT_NAAR_OBJECT_STAGE,PIPELINE_FASES,INTERESSE_LABELS,
} from '@/data/mock-data';
import {REACTIE_REDEN_LABELS} from '@/lib/relaties/aanbiedingsReacties';

/**
 * Stop drift tussen het bestaande CRM, de database-schema's en het
 * transactionele proefontwerp voordat er een live migratie kan ontstaan.
 */
const sql=readFileSync('docs/crm/sql/pipeline-bulk-opslaan-ONTWERP-NIET-UITVOEREN.sql','utf8');
const schema=readFileSync('supabase/migrations/20260809140859_crm_mig_pipeline_fundament.sql','utf8');

describe('Kandidatenbulk / objectpipeline: canonieke schema- en mappingpariteit',()=>{
  it('houdt alle fases en interesseniveaus gelijk aan de bestaande migratie',()=>{
    const fase=schema.match(/create type public\.pipeline_fase as enum\s*\(([^)]*)\)/i);
    const interesse=schema.match(/create type public\.interesse_niveau as enum\s*\(([^)]*)\)/i);
    expect(fase).not.toBeNull();
    expect(interesse).not.toBeNull();
    const parse=(v:string)=>[...v.matchAll(/'([^']+)'/g)].map(x=>x[1]);
    expect(parse(fase![1])).toEqual(PIPELINE_FASES.map(x=>x.key));
    expect(parse(interesse![1])).toEqual(Object.keys(INTERESSE_LABELS));
  });
  it('gebruikt exact dezelfde fase-naar-objectstage-mapping, zonder eindfase',()=>{
    const mapping=sql.match(/v_target_slug:=CASE v_fase::text([\s\S]*?)END;/);
    expect(mapping).not.toBeNull();
    const entries=[...mapping![1].matchAll(/WHEN '([^']+)' THEN '([^']+)'/g)];
    const keys=entries.map(x=>x[1]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.fromEntries(entries.map(x=>[x[1],x[2]])))
      .toEqual(KANDIDAAT_NAAR_OBJECT_STAGE);
    expect(keys).not.toContain('afgevallen');
    expect(keys).not.toContain('afgerond');
  });
  it('de interne afwijsredenen blijven gelijk aan geregistreerde kopersfeedback-taxonomie',()=>{
    const categorie=sql.match(/v_reden NOT IN\s*\(([^)]*)\)/);
    expect(categorie).not.toBeNull();
    const codes=[...categorie![1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
    expect(codes).toEqual(Object.keys(REACTIE_REDEN_LABELS));
  });
});
