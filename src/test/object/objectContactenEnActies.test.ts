import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('CRM objectkaart zonder administratieve ruis',()=>{
  const page=read('src/pages/ObjectDetailPage.tsx');
  const contacts=read('src/components/object/ObjectContactenSectie.tsx');
  it('gebruikt één eigenaarbron en aanvullende contactvelden in een apart component',()=>{
    expect(page).toContain('<ObjectContactenSectie object={object}');
    expect(contacts).toContain('Gekoppelde verkoper / eigenaar');
    expect(contacts).toContain('Aanvullende contactgegevens');
    expect(contacts).toContain('object.verkoperTelefoon');
    expect(contacts).toContain('object.contactTelefoon');
    expect(contacts).toContain('object.verkoopmotivatie');
    expect(page).not.toContain('Vrije tekst / fallback. De gekoppelde relatie');
  });
  it('toont verkoopmotivatie inline in Overzicht en houdt Meer voor contacthistorie',()=>{
    expect(page).toContain('<ObjectKerngegevensInline object={object}');
    expect(page).toContain('hasContactenData(object)');
    expect(page).not.toContain('o.verkoopmotivatie ||');
  });
  it('zet volgende actie vóór transactiestatus zonder actieknoppen te verwijderen',()=>{
    const action=page.indexOf('<div id="next-action"');
    const transaction=page.indexOf('<div id="deal-cockpit"');
    const quick=page.indexOf('<div id="quick-actions"');
    expect(action).toBeGreaterThan(0);
    expect(action).toBeLessThan(transaction);
    expect(transaction).toBeLessThan(quick);
    expect(page).toContain('Taak aanmaken');
    expect(page).toContain('Kandidaat toevoegen');
    expect(page).toContain('Aanbieding openen');
    expect(page).not.toContain('>from Taken<');
  });
});
