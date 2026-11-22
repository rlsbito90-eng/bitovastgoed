import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');

describe('Dossiergegevens na eerste invoer zonder langdurige formulieren',()=>{
  it('ziet eigenaar in Objecten/Overzicht als primaire relatiekeuze',()=>{
    const page=read('src/pages/ObjectDetailPage.tsx');
    expect(page).toContain('<ObjectKerngegevensInline object={object}');
    expect(page).toContain('onSave={(patch)=>store.updateObject(object.id,patch)}');
    expect(page).toContain('toonPrimair={false}');
  });
  it('houdt het uitgebreide formulier voor eerste registratie, maar niet als enige eigenaarinterface',()=>{
    const form=read('src/components/forms/ObjectFormDialog.tsx');
    const quick=read('src/components/forms/ObjectQuickCreateDialog.tsx');
    expect(form).toContain('<RelatieKoppelveld');
    expect(form).toContain("onChange={id=>set('eigenaarRelatieId',id)}");
    expect(form).toContain('Historische losse contactgegevens');
    expect(quick).toContain("eigenaarRelatieId: relatieRol==='eigenaar'");
    expect(quick).toContain("verkoperRelatieId: relatieRol==='verkoper'");
    expect(quick).toContain("aanbiederRelatieId: relatieRol==='aanbieder'");
    expect(form).toContain('form.verkoperNaam');
  });
  it('beide dossiers kunnen taken rechtstreeks bekijken en afronden',()=>{
    const object=read('src/pages/ObjectDetailPage.tsx');
    const relatie=read('src/pages/RelatieDetailPage.tsx');
    const taken=read('src/components/tasks/DossierTakenPanel.tsx');
    expect(object).toContain('Bekijk alle open taken');
    expect(object).toContain('<DossierTakenPanel taken={cockpitTaken}');
    expect(relatie).toContain('<DossierTakenPanel taken={taken}');
    expect(relatie).toContain('store.getTakenByDeal(deal.id)');
    expect(taken).toContain("updateTaak(taak.id,{status:'afgerond'})");
  });
});
