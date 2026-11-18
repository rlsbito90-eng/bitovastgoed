import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');

describe('Dossierbediening: type, m² en eigendom rechtstreeks op Overzicht',()=>{
  it('biedt de bestaande taxonomie inline aan zonder extra duplicaat van badges',()=>{
    const page=read('src/pages/ObjectDetailPage.tsx');
    expect(page).toContain('<ObjectClassificatieInline object={object}');
    expect(page).toContain('<ObjectFysiekInline object={object}');
    expect(page).toContain('onSave={(patch)=>store.updateObject(object.id,patch)}');
    expect(page).not.toContain('<ClassificatieRij');
  });
  it('bewaart oudere juridische en pandgegevens voor detailinzage',()=>{
    const form=read('src/components/forms/ObjectFormDialog.tsx');
    const page=read('src/pages/ObjectDetailPage.tsx');
    expect(form).toContain("set('oppervlakteVvo'");
    expect(form).toContain("set('eigendomssituatie'");
    expect(page).toContain('object.erfpachtinformatie');
    expect(page).toContain('object.oppervlaktenPerVerdieping');
  });
});
