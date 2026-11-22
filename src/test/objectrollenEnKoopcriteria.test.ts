import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');
const store=read('src/hooks/useDataStore.tsx');
const object=read('src/data/mock-data.ts');
const form=read('src/components/forms/ObjectFormDialog.tsx');
const quick=read('src/components/forms/ObjectQuickCreateDialog.tsx');
const card=read('src/components/object/ObjectKerngegevensInline.tsx');
const relation=read('src/pages/RelatieDetailPage.tsx');
const relationForm=read('src/components/forms/RelatieFormDialog.tsx');
const schema=read('supabase/migrations/20261122230642_crm_objectrollen_en_aankoopvoorwaarden.sql');

describe('Objectgebonden rollen en koopcriteria: additive CRM-safe data contract',()=>{
  it('legt objectrollen apart vast, zonder de historische eigenaar-koppeling te migreren',()=>{
    expect(object).toContain('verkoperRelatieId?: string | null;');
    expect(object).toContain('aanbiederRelatieId?: string | null;');
    expect(store).toContain('verkoperRelatieId: (o as any).verkoper_relatie_id');
    expect(store).toContain('aanbiederRelatieId: (o as any).aanbieder_relatie_id');
    expect(store).toContain('verkoper_relatie_id: o.verkoperRelatieId !== undefined');
    expect(store).toContain('aanbieder_relatie_id: o.aanbiederRelatieId !== undefined');
    expect(schema).toContain('ADD COLUMN IF NOT EXISTS verkoper_relatie_id');
    expect(schema).toContain('ADD COLUMN IF NOT EXISTS aanbieder_relatie_id');
    expect(schema).not.toMatch(/UPDATE\s+public\.objecten/i);
  });

  it('laat eigenaar, verkoper en aanbiedende partij afzonderlijk aanpassen',()=>{
    expect(card).toContain("key:'eigenaarRelatieId'");
    expect(card).toContain("key:'verkoperRelatieId'");
    expect(card).toContain("key:'aanbiederRelatieId'");
    expect(card).toContain('await onSave({[veld]:nieuw})');
    expect(card).toContain('niet automatisch gewijzigd');
    expect(form).toContain("onChange={id=>set('verkoperRelatieId',id)}");
    expect(form).toContain("onChange={id=>set('aanbiederRelatieId',id)}");
  });

  it('dwingt in snel aanmaken een bewuste rolkeuze af',()=>{
    expect(quick).toContain("if (relatieId && !relatieRol)");
    expect(quick).toContain("relatieRol==='eigenaar'");
    expect(quick).toContain("relatieRol==='verkoper'");
    expect(quick).toContain("relatieRol==='aanbieder'");
    expect(quick).toContain('Rol bij dit object *');
  });

  it('bewaart harde voorwaarden en vrijblijvende voorkeuren in afzonderlijke velden',()=>{
    expect(store).toContain('hardeAankoopvoorwaarden: (r as any).harde_aankoopvoorwaarden');
    expect(store).toContain('aankoopvoorkeuren: (r as any).aankoopvoorkeuren');
    expect(store).toContain('harde_aankoopvoorwaarden: r.hardeAankoopvoorwaarden !== undefined');
    expect(store).toContain('aankoopvoorkeuren: r.aankoopvoorkeuren !== undefined');
    expect(schema).toContain('ADD COLUMN IF NOT EXISTS harde_aankoopvoorwaarden');
    expect(schema).toContain('ADD COLUMN IF NOT EXISTS aankoopvoorkeuren');
    expect(relation).toContain('Matchvoorwaarden — hard versus voorkeur');
    expect(relation).toContain('toonAlleVeldenInitieel');
    expect(relationForm).toContain("set('hardeAankoopvoorwaarden'");
    expect(relationForm).toContain("set('aankoopvoorkeuren'");
  });

  it('behoudt het oude vrije tekstveld en verandert legacy criteria niet stilzwijgend',()=>{
    expect(store).toContain('aankoopcriteria: r.aankoopcriteria ?? undefined');
    expect(relation).toContain('Algemene acquisitietoelichting (historisch)');
    expect(relation).toContain('Overige expliciete uitsluitingen (historisch)');
    expect(schema).not.toMatch(/UPDATE\s+public\.relaties/i);
  });
});
