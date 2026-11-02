import {describe,it,expect} from 'vitest';
import {
  wijzigbareActiviteiten, voegActiviteitenSamen, gelijkeRollen, magAanvullendeActiviteit,
} from './transactieactiviteiten';

describe('A15.4 — één activiteitenbron en behoud historische data',()=>{
  it('laat een ontwikkelaar tegelijk bemiddelen zonder een tweede hoofdprofiel',()=>{
    expect(voegActiviteitenSamen(['ontwikkelaar'],['bemiddelaar']))
      .toEqual(['ontwikkelaar','bemiddelaar']);
  });
  it('A15.9: bemiddelaar als hoofdprofiel mag ontwikkelaar als aanvullende activiteit vastleggen',()=>{
    expect(magAanvullendeActiviteit('ontwikkelaar','bemiddelaar')).toBe(true);
    expect(voegActiviteitenSamen(null,['ontwikkelaar'],'bemiddelaar'))
      .toEqual(['ontwikkelaar']);
    expect(wijzigbareActiviteiten(['ontwikkelaar'],'bemiddelaar'))
      .toEqual(['ontwikkelaar']);
  });
  it('A15.9: een ontwikkelaar of ontwikkelende belegger voert zichzelf niet dubbel in',()=>{
    for(const profiel of ['ontwikkelaar','ontwikkelende_belegger'] as const){
      expect(magAanvullendeActiviteit('ontwikkelaar',profiel)).toBe(false);
      expect(wijzigbareActiviteiten(['ontwikkelaar'],profiel)).toEqual([]);
      expect(voegActiviteitenSamen(['ontwikkelaar'],[],profiel)).toEqual(['ontwikkelaar']);
    }
    expect(magAanvullendeActiviteit('bemiddelaar','bemiddelaar')).toBe(false);
    expect(voegActiviteitenSamen(['bemiddelaar'],['ontwikkelaar'],'bemiddelaar'))
      .toEqual(['bemiddelaar','ontwikkelaar']);
  });
  it('A15.9: oude ontwikkelaarrol wordt bij onbekend profiel niet automatisch nieuwe activiteit',()=>{
    expect(magAanvullendeActiviteit('ontwikkelaar',null)).toBe(false);
    expect(wijzigbareActiviteiten(['ontwikkelaar'],null)).toEqual([]);
    expect(voegActiviteitenSamen(['ontwikkelaar','koper'],[],null))
      .toEqual(['ontwikkelaar']);
  });
  it('A15.9: later verwijderde aanvullende ontwikkelaar mag gewist zonder historische andere rollen',()=>{
    const bestaand=['makelaar','ontwikkelaar','koper'] as const;
    expect(voegActiviteitenSamen(bestaand,['koper'],'bemiddelaar'))
      .toEqual(['makelaar','koper']);
    expect(bestaand).toEqual(['makelaar','ontwikkelaar','koper']);
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
