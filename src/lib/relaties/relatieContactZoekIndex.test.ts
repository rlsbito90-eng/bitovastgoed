import {describe,it,expect} from 'vitest';
import {maakContactNaamIndex,matchRelatieZoekterm} from './relatieContactZoekIndex';

const relatie=(id:string,bedrijfsnaam:string,contactpersoon='')=>({
  id,bedrijfsnaam,contactpersoon,
});
describe('A15.7 — relaties ook via contactpersoon terugvinden',()=>{
  const index=maakContactNaamIndex([
    {relatieId:'persoon',naam:'Voorbeeld Steven'},
    {relatieId:'bedrijf',naam:'Voorbeeld Jesper'},
  ]);
  it('vindt een relatie zonder bedrijfsnaam via geregistreerde primaire contactpersoon',()=>{
    expect(matchRelatieZoekterm(relatie('persoon','',''),'steven',index)).toBe(true);
    expect(matchRelatieZoekterm(relatie('persoon','',''),'VOORBEELD',index)).toBe(true);
  });
  it('leidt geen bedrijfsnaam of partijprofiel af en mengt contacten niet',()=>{
    expect(matchRelatieZoekterm(relatie('bedrijf','Voorbeeld Invest'),'steven',index)).toBe(false);
    expect(matchRelatieZoekterm(relatie('bedrijf','Voorbeeld Invest'),'invest',index)).toBe(true);
    expect(matchRelatieZoekterm(relatie('persoon','',''),'onbekend',index)).toBe(false);
  });
  it('leeg zoekveld blijft alle relaties tonen, ook als bedrijfsnaam ontbreekt',()=>{
    expect(matchRelatieZoekterm(relatie('persoon','',''),' ',index)).toBe(true);
  });
  it('negeert lege contactnamen en bewaart de brongegevens',()=>{
    const bron=Object.freeze([{relatieId:'x',naam:''}]);
    expect(maakContactNaamIndex(bron).has('x')).toBe(false);
    expect(bron[0].naam).toBe('');
  });
});
