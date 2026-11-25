import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('Kandidaatselectie: aanbiederuitsluiting is ook in de UI en save-route actief',()=>{
  const dialog=source('src/components/pipeline/KandidaatSelectieDialog.tsx');
  const voorstel=source('src/components/pipeline/KandidaatVoorstellenR2.tsx');
  const relatie=source('src/lib/matching/relatieObjectVoorstellenR2.ts');
  const adapter=source('src/lib/matching/rolMandaatAdapter.ts');

  it('zoekt contactpersonen bij relaties en sluit aanbieder uit beide lijsten',()=>{
    expect(dialog).toContain('contactpersoonNamen: contacten.map(c => c.naam)');
    expect(dialog).toContain('contactEmails: contacten.map(c => c.email)');
    expect(dialog).toContain('isObjectAanbiederRelatie(object, relatie)');
    expect(dialog).toContain('!aanbiederRelatieIds.has(r.id)');
    expect(dialog).toContain('object={object} relaties={matchingRelaties}');
    expect(dialog).toContain('Aanbieders en verkopers van dit object worden uitgesloten');
  });

  it('weert oude handmatige en automatisch gekozen aanbieder nogmaals voor opslaan',()=>{
    expect(dialog).toContain('[...geselecteerd].some(id => aanbiederRelatieIds.has(id))');
    expect(dialog).toContain('if (aanbiederRelatieIds.has(relatieId))');
    expect(dialog).toContain('maakKandidaatVoorstellen(object,matchingRelaties,zoekprofielen');
    expect(adapter).toContain('isObjectAanbiederRelatie(object,r)');
    expect(adapter).toContain('[object.eigenaarRelatieId,object.verkoperRelatieId,object.aanbiederRelatieId]');
  });

  it('past dezelfde regel toe op voorstellen in het relatiedossier',()=>{
    expect(relatie).toContain('eigenaarRelatieId: object.eigenaarRelatieId');
    expect(relatie).toContain('verkoperNaam: object.verkoperNaam');
    expect(relatie).toContain('contactNaam: object.contactNaam');
  });

  it('geeft een snelle en expliciete route naar het kopersprofiel',()=>{
    expect(voorstel).toContain('onOpenRelatie?: (relatieId: string) => void');
    expect(voorstel).toContain('Kopersprofiel <ArrowUpRight');
    expect(dialog).toContain('navigate(`/relaties/${id}?matchObject=${encodeURIComponent(objectId)}`)');
    const relatiePage=source('src/pages/RelatieDetailPage.tsx');
    const objectPage=source('src/pages/ObjectDetailPage.tsx');
    expect(relatiePage).toContain('Terug naar kandidaatselectie');
    expect(relatiePage).toContain('matchRelatie=${encodeURIComponent(relatie.id)}');
    expect(objectPage).toContain("params.get('matchRelatie')");
    expect(objectPage).toContain('focusRelatieId={matchFocusRelatie}');
  });
});
