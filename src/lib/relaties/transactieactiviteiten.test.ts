import {describe,it,expect} from 'vitest';
import {
  wijzigbareActiviteiten, voegActiviteitenSamen, gelijkeRollen,
} from './transactieactiviteiten';

describe('A15.4 — één activiteitenbron en behoud historische data',()=>{
  it('laat een ontwikkelaar tegelijk bemiddelen zonder een tweede hoofdprofiel',()=>{
    expect(voegActiviteitenSamen(['ontwikkelaar'],['bemiddelaar']))
      .toEqual(['ontwikkelaar','bemiddelaar']);
  });
  it('laat een ontwikkelende belegger als koper registreren',()=>{
    expect(voegActiviteitenSamen(null,['koper'])).toEqual(['koper']);
  });
  it('houdt historische makelaar/ontwikkelaar en aanvullende rollen intact',()=>{
    const roles=['ontwikkelaar','makelaar','overig','verkoper'] as const;
    expect(voegActiviteitenSamen(roles,['koper','bemiddelaar']))
      .toEqual(['ontwikkelaar','makelaar','overig','koper','bemiddelaar']);
  });
  it('laat de historische rollen ongemoeid bij het leegmaken van activiteiten',()=>{
    expect(voegActiviteitenSamen(['ontwikkelaar','koper','bemiddelaar'],[]))
      .toEqual(['ontwikkelaar']);
  });
  it('heeft geen automatische koper of bemiddelaar bij onbekende rol',()=>{
    expect(wijzigbareActiviteiten(null)).toEqual([]);
    expect(wijzigbareActiviteiten(['ontwikkelaar'])).toEqual([]);
  });
  it('dedupliceert rollen zonder de bronarray te veranderen',()=>{
    const a=Object.freeze(['ontwikkelaar','koper'] as const);
    const result=voegActiviteitenSamen(a,['koper','bemiddelaar','koper']);
    expect(result).toEqual(['ontwikkelaar','koper','bemiddelaar']);
    expect(a).toEqual(['ontwikkelaar','koper']);
    expect(gelijkeRollen(result,['bemiddelaar','koper','ontwikkelaar'])).toBe(true);
  });
});
