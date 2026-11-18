import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read=(filename:string)=>fs.readFileSync(path.join(process.cwd(),filename),'utf8');

describe('Professionele vastgoedclassificatie, één ontwerp in Objecten en Relaties',()=>{
  it('behoudt de taxonomiebron en presenteert leesregels in plaats van badges op detailkaarten',()=>{
    const summary=read('src/components/TaxonomieBadges.tsx');
    expect(summary).toContain('data-testid="taxonomie-samenvatting"');
    expect(summary).toContain('propertyTypeById(propertyTypeId)');
    expect(summary).toContain('propertySubtypeById(id)');
    expect(summary).toContain('dealTypeById(id)');
    const object=read('src/components/object/ObjectClassificatieInline.tsx');
    const relation=read('src/components/relatie/InlineVastgoedVoorkeuren.tsx');
    expect(object).toContain('<ClassificatieRij');
    expect(relation).toContain('<ClassificatieRij');
  });
  it('gebruikt dezelfde doorzoekbare checklist in Objecten, Relaties, eerste invoer en zoekprofielen',()=>{
    for(const file of [
      'src/components/object/ObjectClassificatieInline.tsx',
      'src/components/relatie/InlineVastgoedVoorkeuren.tsx',
      'src/components/forms/RelatieFormDialog.tsx',
      'src/components/forms/ZoekprofielFormDialog.tsx',
    ]){
      expect(read(file)).toContain('<TaxonomieKeuzelijst');
    }
    expect(read('src/components/relatie/InlineVastgoedVoorkeuren.tsx'))
      .toContain('knownOrphans.length');
  });
  it('verwijdert dubbele type/subtype/dealtype-regels onderaan het objectoverzicht',()=>{
    const page=read('src/pages/ObjectDetailPage.tsx');
    expect(page).not.toContain('<Field label="Type vastgoed">{propertyTypeLabel}</Field>');
    expect(page).not.toContain('<Field label="Subtype">{subtypeLabel}</Field>');
    expect(page).not.toContain('<Field label="Dealtype / propositie">{dealTypeLabels.join(');
    expect(page).toContain('Identificatie en bron');
    expect(page).toContain('<Field label="Toegevoegd">');
    expect(page).toContain('<ObjectCommercieelInline object={object} verhuur={verhuur} embedded');
    expect(page).toContain('<ObjectFysiekInline object={object}');
    expect(page).toContain('Oppervlakten en eigendom');
  });
  it('behoudt directe inline bewerking en expliciete bevestiging bij typewijziging',()=>{
    const object=read('src/components/object/ObjectClassificatieInline.tsx');
    expect(object).toContain('wilTypeWijzigen');
    expect(object).toContain('propertySubtypeIds:next');
    expect(object).toContain('Type wijzigen en subcategorieën wissen');
  });
});
