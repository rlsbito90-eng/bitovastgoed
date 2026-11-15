import {describe,expect,it} from 'vitest';
import {sorteerObjectKandidaten, type SorteerbareKandidaat} from './kandidaatSortering';
type K=SorteerbareKandidaat & {naam:string};
const mk=(id:string,extra:Partial<K>={}):K=>({
  id,naam:id,pipelineFase:'match_gevonden',interesseNiveau:'lauw',
  ...extra,
});
const sort=(rows:K[],s:Parameters<typeof sorteerObjectKandidaten<K>>[1])=>
  sorteerObjectKandidaten(rows,s,k=>k.naam).map(k=>k.id);
describe('Kandidaatpipeline ordent op actie in plaats van historische matchpercentages',()=>{
  it('geeft actieve kandidaten en vroegste opvolging prioriteit; afgevallen blijft zichtbaar',()=>{
    const arr=[
      mk('afgevallen',{pipelineFase:'afgevallen',matchscore:99}),
      mk('actief2',{matchscore:76,volgendeActieDatum:'2026-11-20'}),
      mk('afgerond',{pipelineFase:'afgerond',matchscore:98}),
      mk('actief1',{matchscore:3,volgendeActieDatum:'2026-11-18'}),
    ];
    expect(sort(arr,'aanbevolen')).toEqual(['actief1','actief2','afgerond','afgevallen']);
  });
  it('hoge historische matchscore overrulet geen concrete vervolgstap',()=>{
    const arr=[
      mk('hoog',{matchscore:99,volgendeActieDatum:'2026-12-04'}),
      mk('laag',{matchscore:12,volgendeActieDatum:'2026-11-16'}),
      mk('onbekend',{volgendeActieDatum:'2026-11-19'}),
    ];
    expect(sort(arr,'aanbevolen')).toEqual(['laag','onbekend','hoog']);
  });
  it('zonder opvolgdatum is actieve interesse relevant, niet de oude score',()=>{
    const arr=[
      mk('koel',{matchscore:100,interesseNiveau:'koud'}),
      mk('warm',{matchscore:1,interesseNiveau:'zeer_warm'}),
    ];
    expect(sort(arr,'aanbevolen')).toEqual(['warm','koel']);
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
