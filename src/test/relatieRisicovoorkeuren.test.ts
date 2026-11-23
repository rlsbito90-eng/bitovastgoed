import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  RISICO_CATEGORIEEN,isBevestigdeRisicoUitsluiting,valideerRisicoInvoer,
} from '@/lib/relaties/risicovoorkeuren';

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('Risicovoorkeuren in CRM',()=>{
  it('behoudt onbekend als onbekend; accepteert nooit stilzwijgend',()=>{
    expect(isBevestigdeRisicoUitsluiting(null,true)).toBe(false);
    expect(isBevestigdeRisicoUitsluiting(undefined,true)).toBe(false);
    expect(RISICO_CATEGORIEEN.map(c=>c.waarde).length).toBe(7);
    expect(new Set(RISICO_CATEGORIEEN.map(c=>c.waarde)).size).toBe(7);
  });
  it('een voorlopige uitsluiting is niet automatisch hard',()=>{
    expect(isBevestigdeRisicoUitsluiting({
      bereidheid:'sluit_uit',bevestigd:false,
    },true)).toBe(false);
    expect(isBevestigdeRisicoUitsluiting({
      bereidheid:'sluit_uit',bevestigd:true,
    },false)).toBe(false);
    expect(isBevestigdeRisicoUitsluiting({
      bereidheid:'sluit_uit',bevestigd:true,
    },true)).toBe(true);
  });
  it('voorwaardelijke acceptatie blijft geen harde uitsluiting',()=>{
    expect(isBevestigdeRisicoUitsluiting({
      bereidheid:'onder_voorwaarden',bevestigd:true,
    },true)).toBe(false);
    expect(isBevestigdeRisicoUitsluiting({
      bereidheid:'accepteert',bevestigd:true,
    },true)).toBe(false);
  });
  it('bevestiging zonder concrete bron is ongeldig',()=>{
    expect(valideerRisicoInvoer('leegstand','sluit_uit',true,null)).toMatch(/bron/);
    expect(valideerRisicoInvoer('leegstand','sluit_uit',true,'   ')).toMatch(/bron/);
    expect(valideerRisicoInvoer('leegstand','sluit_uit',true,'Telefoongesprek')).toBeNull();
    expect(valideerRisicoInvoer('leegstand','onder_voorwaarden',false,null)).toBeNull();
  });
  it('voegt toe zonder bestaande financiering, rendement of matching te vervangen',()=>{
    const page=read('src/pages/RelatieDetailPage.tsx');
    const store=read('src/hooks/useDataStore.tsx');
    const model=read('src/data/mock-data.ts');
    const sql=read('supabase/migrations/20261123002840_relatie_risicovoorkeuren_en_horizon.sql');
    expect(page).toContain('<RisicovoorkeurenPanel');
    expect(page).toContain('<RendementscriteriaPanel');
    expect(page).toContain('InlineRelatieClassificatie');
    expect(store).toContain('beleggingshorizon: r.beleggingshorizon ?? undefined');
    expect(model).toContain('investeringsdoel?:');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('public.is_intern_gebruiker');
    expect(sql).toContain('UNIQUE (relatie_id, risicotype)');
    // Geen automatische uitsluitingen op basis van een niet-bevestigd risicoprofiel.
    expect(read('src/lib/matching/rolMandaatAdapter.ts')).not.toContain('relatie_risicovoorkeuren');
  });
});
