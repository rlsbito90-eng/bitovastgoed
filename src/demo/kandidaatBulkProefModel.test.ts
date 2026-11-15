import {describe,expect,it} from 'vitest';
import {fictieveKandidaten,pasFictieveBulkActieToe} from './kandidaatBulkProefModel';

describe('Bulkacties zonder dubbele administratie',()=>{
  it('wijzigt exact twee geselecteerde kandidaten, zonder de overige zes te wijzigen',()=>{
    const init=fictieveKandidaten();
    const r=pasFictieveBulkActieToe(init,new Set(['a','c']),{
      type:'afwijzen',bron:'intern',categorie:'locatie',
    });
    expect(r.fout).toBeNull();
    expect(r.aangepast).toBe(2);
    expect(r.kandidaten.filter(k=>k.pipelineFase==='afgevallen')).toHaveLength(4);
    expect(r.kandidaten[0].afwijzing).toEqual({bron:'intern',categorie:'locatie'});
    expect(r.kandidaten[2].afwijzing?.bron).toBe('intern');
    expect(init[0].pipelineFase).toBe('interesse_ontvangen');
    expect(r.kandidaten[1]).toEqual(init[1]);
  });
  it('een interne uitsluiting mag niet worden voorgesteld als een ontvangen kopersreactie',()=>{
    const r=pasFictieveBulkActieToe(fictieveKandidaten(),new Set(['a']),{
      type:'afwijzen',bron:'intern',categorie:'prijs',
    });
    expect(r.kandidaten[0].afwijzing?.bron).toBe('intern');
  });
  it('kopersafwijzingen kunnen niet in bulk tot fictieve reacties leiden',()=>{
    const current=fictieveKandidaten();
    const r=pasFictieveBulkActieToe(current,new Set(['a','b']),{
      type:'afwijzen',bron:'koper',categorie:'rendement',
    } as never);
    expect(r.fout).toMatch(/afzonderlijk/);
    expect(r.kandidaten).toEqual(current);
    expect(r.aangepast).toBe(0);
  });
  it('een ontbrekende reden of ongeldige selectie wijzigt niets',()=>{
    const current=fictieveKandidaten();
    const failed=pasFictieveBulkActieToe(current,new Set(['a']),{
      type:'afwijzen',bron:'koper',categorie:'' as never,
    });
    expect(failed.fout).toMatch(/categorie/);
    expect(failed.kandidaten).toEqual(current);
    const another=pasFictieveBulkActieToe(current,new Set(['missing']),{
      type:'interesse',niveau:'warm',
    });
    expect(another.aangepast).toBe(0);
    expect(another.kandidaten).toEqual(current);
  });
  it('andere reden vereist toelichting; gewone fasewijziging is apart van afvallen',()=>{
    const current=fictieveKandidaten();
    expect(pasFictieveBulkActieToe(current,new Set(['b']),{
      type:'afwijzen',bron:'intern',categorie:'anders',
    }).fout).toMatch(/toelichting/);
    const r=pasFictieveBulkActieToe(current,new Set(['a','b']),{
      type:'fase',fase:'informatie_gedeeld',
    });
    expect(r.aangepast).toBe(2);
    expect(r.kandidaten[0].pipelineFase).toBe('informatie_gedeeld');
    expect(r.kandidaten[0].afwijzing).toBeUndefined();
  });
  it('een afgevallen partij wordt niet ongemerkt in bulk gereactiveerd',()=>{
    const r=pasFictieveBulkActieToe(fictieveKandidaten(),new Set(['g']),{
      type:'interesse',niveau:'warm',
    });
    expect(r.fout).toMatch(/opnieuw activeren/);
  });
  it('alleen werkelijk gewijzigde kandidaten tellen mee',()=>{
    const huidige=fictieveKandidaten();
    const r=pasFictieveBulkActieToe(huidige,new Set(['a','b']),{
      type:'fase',fase:'informatie_gedeeld',
    });
    expect(r.aangepast).toBe(1);
    expect(r.ongewijzigd).toBe(1);
    expect(r.gewijzigdeIds).toEqual(['a']);
    expect(r.kandidaten[1]).toBe(huidige[1]);
  });
  it('één afgevallen kandidaat blokkeert de héle bulkactie',()=>{
    const huidige=fictieveKandidaten();
    const r=pasFictieveBulkActieToe(huidige,new Set(['a','g']),{
      type:'afwijzen',bron:'intern',categorie:'locatie',
    });
    expect(r.fout).toMatch(/afgevallen/);
    expect(r.kandidaten).toEqual(huidige);
    expect(r.gewijzigdeIds).toEqual([]);
  });
  it('ongeldige categorie en onbekende fase voeren nooit wijzigingen uit',()=>{
    const huidige=fictieveKandidaten();
    expect(pasFictieveBulkActieToe(huidige,new Set(['a']),{
      type:'afwijzen',bron:'intern',categorie:'fout',
    } as never).fout).toMatch(/geldige afwijzingscategorie/);
    expect(pasFictieveBulkActieToe(huidige,new Set(['a']),{
      type:'fase',fase:'bogus',
    } as never).aangepast).toBe(0);
  });
});
