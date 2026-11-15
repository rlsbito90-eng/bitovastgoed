import {describe,expect,it} from 'vitest';
import {sorteerObjectKandidaten, type SorteerbareKandidaat} from './kandidaatSortering';
type K=SorteerbareKandidaat & {naam:string};
const mk=(id:string,extra:Partial<K>={}):K=>({
  id,naam:id,pipelineFase:'match_gevonden',interesseNiveau:'lauw',
  ...extra,
});
const sort=(rows:K[],s:Parameters<typeof sorteerObjectKandidaten<K>>[1])=>
  sorteerObjectKandidaten(rows,s,k=>k.naam).map(k=>k.id);
describe('Sorteervolgorde bestaande kandidaatpipeline',()=>{
  it('toont actieve kandidaten eerst op aflopende matchscore; afgevallen blijft aanwezig',()=>{
    const arr=[
      mk('afgevallen',{pipelineFase:'afgevallen',matchscore:99}),
      mk('actief2',{matchscore:76}),
      mk('afgerond',{pipelineFase:'afgerond',matchscore:98}),
      mk('actief1',{matchscore:93}),
    ];
    expect(sort(arr,'aanbevolen')).toEqual(['actief1','actief2','afgerond','afgevallen']);
    expect(sort(arr,'match')).toEqual(['afgevallen','afgerond','actief1','actief2']);
  });
  it('laat onbekende score achteraan en behoudt invoer bij gelijke score',()=>{
    expect(sort([mk('geen'),mk('twee',{matchscore:90}),mk('een',{matchscore:90})],'match'))
      .toEqual(['twee','een','geen']);
  });
  it('sorteert interesse, naam, fase, activiteit en actie zonder opslag te muteren',()=>{
    const rows=[
      mk('Z',{naam:'Zand',pipelineFase:'informatie_gedeeld',interesseNiveau:'zeer_warm',
        laatsteContactdatum:'2026-11-10',volgendeActieDatum:'2026-11-22'}),
      mk('A',{naam:'Aarts',pipelineFase:'match_gevonden',interesseNiveau:'koud',
        laatsteContactdatum:'2026-11-14',volgendeActieDatum:'2026-11-18'}),
      mk('B',{naam:'Bakker',pipelineFase:'bezichtiging_gepland',interesseNiveau:'warm'}),
    ];
    expect(sort(rows,'naam')).toEqual(['A','B','Z']);
    expect(sort(rows,'interesse')).toEqual(['Z','B','A']);
    expect(sort(rows,'recent')).toEqual(['A','Z','B']);
    expect(sort(rows,'vervolg')).toEqual(['A','Z','B']);
    expect(sort(rows,'fase')).toEqual(['B','Z','A']);
    expect(rows[0].id).toBe('Z');
  });
});
