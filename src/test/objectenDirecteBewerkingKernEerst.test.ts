import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Objectdossier: commerciële gegevens eerst en titel direct aanpasbaar', () => {
  const detail = read('src/pages/ObjectDetailPage.tsx');
  const inlineTitle = read('src/components/object/ObjectTitelInline.tsx');

  it('laat klikken op objectnaam rechtstreeks opslaan met bestaande updateObject', () => {
    expect(detail).toContain('<ObjectTitelInline object={object}');
    expect(detail).toContain('onSave={(patch)=>store.updateObject(object.id,patch)}');
    expect(detail).not.toContain('<h1 className="text-2xl sm:text-3xl lg:text-[34px]');
    expect(inlineTitle).toContain('await onSave({ titel: next })');
    expect(inlineTitle).toContain('onBlur={() => { void save(); }}');
    expect(inlineTitle).toContain("if (event.key === 'Enter')");
    expect(inlineTitle).toContain("if (event.key === 'Escape')");
  });

  it('toont eigenaar, status, prijs en huur vóór matchclassificatie', () => {
    const overzicht = detail.slice(
      detail.indexOf('{activeTab === \'overzicht\' && ('),
      detail.indexOf('{activeTab === \'dealflow\' && ('),
    );
    const eigenaar = overzicht.indexOf('<ObjectKerngegevensInline');
    const commercieel = overzicht.indexOf('<ObjectCommercieelInline');
    const classificatie = overzicht.indexOf('<ObjectClassificatieInline');
    expect(eigenaar).toBeGreaterThan(0);
    expect(eigenaar).toBeLessThan(commercieel);
    expect(commercieel).toBeLessThan(classificatie);
    expect(overzicht).toContain('<ObjectFysiekInline');
    expect(overzicht).toContain('<ObjectLocatieInline');
    expect(overzicht).toContain('store.updateObject(object.id,patch)');
  });

  it('behoudt de overige objecttabs, kopacties en financiële gegevens', () => {
    expect(detail).toContain('<WorkspaceTabsNav tabs={visibleTabs}');
    expect(detail).toContain('<ObjectPdfButton object={object} />');
    expect(detail).toContain('setEditOpen(true)');
    expect(detail).toContain("key=\"vraagprijs\"");
    expect(detail).toContain("key=\"factor\"");
    expect(detail).toContain("key=\"huur\"");
    expect(detail).toContain('onClick={()=>{setEditTaak(null);setTaakDialogOpen(true);}}');
  });
});
