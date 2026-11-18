import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');

describe('Objectdossier: geen tweede invoer of verborgen hoofdformulieren voor dagelijkse velden',()=>{
  it('biedt adres en onderhoud direct op de juiste tab en behoudt expliciete BAG-validatie',()=>{
    const page=read('src/pages/ObjectDetailPage.tsx');
    expect(page).toContain('<ObjectLocatieInline object={object}');
    expect(page).toContain('<ObjectOnderhoudInline object={object}');
    expect(page).toContain('<PdokLocatieVerifier');
    expect(page).toContain('objectIntegriteit.ontbrekendeVelden');
  });
  it('toont aanbiedingswijze maar op één plek als direct wijzigbare keuze',()=>{
    const page=read('src/pages/ObjectDetailPage.tsx');
    const finance=read('src/components/object/ObjectCommercieelInline.tsx');
    expect(page).not.toContain('<Field label="Aanbiedingswijze">');
    expect(finance).toContain('<ObjectAanbiedingInline object={object}');
  });
  it('bewaart het bestaande eerste-invoerformulier en alle detailvelden',()=>{
    const form=read('src/components/forms/ObjectFormDialog.tsx');
    for(const field of ['adres','postcode','plaats','provincie','aanbiedingswijze',
      'onderhoudsstaatNiveau','technischeStaatOmschrijving']){
      expect(form).toContain(field);
    }
  });
});
