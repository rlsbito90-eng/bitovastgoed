/**
 * Matching 3.0 — pure evaluatie van expliciete acquisitievoorwaarden.
 * Geen automatische communicatie, kandidatuur of transactiebeslissing.
 */
export type CriteriumSterkte = 'hard' | 'voorkeur' | 'uitsluiten';
export type CriteriumVeld =
  | 'provincie' | 'gemeente' | 'plaats'
  | 'vastgoedtype' | 'strategie' | 'verhuurstatus'
  | 'koopprijs_min' | 'koopprijs_max'
  | 'bar_min' | 'oppervlakte_min' | 'oppervlakte_max';
export type CriteriumRegel = Readonly<{
  id: string;
  veld: CriteriumVeld;
  waarde: string | number;
  sterkte: CriteriumSterkte;
  actief?: boolean;
}>;
export interface CriteriumObject {
  provincie?: string | null;
  /** Alleen expliciet geverifieerde bestuurlijke gemeenten gebruiken. */
  gemeente?: string | null;
  plaats?: string | null;
  propertyTypeId?: string | null;
  strategieen?: readonly string[] | null;
  verhuurstatus?: string | null;
  vraagprijs?: number | null;
  /** BAR in procentpunten, bijv. 8 voor 8%. Geen ongecontroleerde berekening. */
  bar?: number | null;
  oppervlakte?: number | null;
}
export type CriteriumUitkomst = 'voldoet' | 'voldoet_niet' | 'onbekend';
export type CriteriumKwalificatie = 'passend' | 'te_verifieren' | 'afwijkend';
export interface CriteriumBeoordeling {
  kwalificatie: CriteriumKwalificatie;
  uitsluitingen: string[];
  hardeAfwijkingen: string[];
  teControleren: string[];
  voorkeurenPassend: string[];
  voorkeurenAfwijkend: string[];
  /** Alleen rangschikkingssignaal, geen transactieprobabiliteit. */
  voorkeurScore: { behaald: number; getoetst: number };
}

const LOCATIE = new Set<CriteriumVeld>(['provincie','gemeente','plaats']);
const NUMERIEK = new Set<CriteriumVeld>([
  'koopprijs_min','koopprijs_max','bar_min','oppervlakte_min','oppervlakte_max',
]);
const canon = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim().toLocaleLowerCase('nl-NL').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : '';
const label = (r:CriteriumRegel):string => r.veld.replaceAll('_',' ') + ': ' + String(r.waarde);
export function valideerCriteriumRegels(regels: readonly CriteriumRegel[]): string[] {
  const fouten: string[] = [];
  const ids = new Set<string>();
  const waarden = new Set<string>();
  for (const r of regels) {
    if (!r.id.trim() || ids.has(r.id)) fouten.push('Iedere regel heeft een unieke ID nodig.');
    ids.add(r.id);
    if (r.sterkte === 'uitsluiten' && NUMERIEK.has(r.veld))
      fouten.push('Gebruik een harde numerieke onder- of bovengrens voor ' + r.veld);
    if (NUMERIEK.has(r.veld)) {
      if (typeof r.waarde !== 'number' || !Number.isFinite(r.waarde) || r.waarde < 0)
        fouten.push('Ongeldige numerieke waarde bij ' + r.veld);
    } else if (typeof r.waarde !== 'string' || !r.waarde.trim()) {
      fouten.push('Lege of ongeldige tekstwaarde bij ' + r.veld);
    }
    const sleutel = r.veld + ':' +
      (typeof r.waarde === 'string' ? canon(r.waarde) : String(r.waarde));
    if (waarden.has(sleutel)) fouten.push('Dubbele criteriumwaarde bij ' + r.veld);
    waarden.add(sleutel);
  }
  return fouten;
}

export function toetsCriterium(r:CriteriumRegel,object:CriteriumObject):CriteriumUitkomst{
  if(NUMERIEK.has(r.veld)){
    const actual=r.veld.startsWith('koopprijs_')?object.vraagprijs
      :r.veld==='bar_min'?object.bar:object.oppervlakte;
    if(actual == null || !Number.isFinite(actual) ||
      typeof r.waarde !== 'number' || !Number.isFinite(r.waarde))return 'onbekend';
    return (r.veld.endsWith('_min')?actual >= r.waarde:actual <= r.waarde)
      ?'voldoet':'voldoet_niet';
  }
  const gezocht=canon(r.waarde);
  if(!gezocht)return 'onbekend';
  if(r.veld==='strategie'){
    if(!object.strategieen?.length)return 'onbekend';
    return object.strategieen.some(v=>canon(v)===gezocht)?'voldoet':'voldoet_niet';
  }
  const actual=r.veld==='provincie'?object.provincie
    :r.veld==='gemeente'?object.gemeente
    :r.veld==='plaats'?object.plaats
    :r.veld==='vastgoedtype'?object.propertyTypeId
    :object.verhuurstatus;
  if(typeof actual!=='string'||!actual.trim())return 'onbekend';
  return canon(actual)===gezocht?'voldoet':'voldoet_niet';
}

export function beoordeelCriteriumRegels(
  regels:readonly CriteriumRegel[],object:CriteriumObject,
):CriteriumBeoordeling{
  const uitsluitingen:string[]=[];
  const hardeAfwijkingen:string[]=[];
  const teControleren:string[]=[];
  const voorkeurenPassend:string[]=[];
  const voorkeurenAfwijkend:string[]=[];
  let getoetst=0,behaald=0;
  const actief=regels.filter(r=>r.actief!==false);
  const groepen=new Map<string,CriteriumRegel[]>();
  for(const r of actief.filter(r=>r.sterkte==='hard')){
    // Positieve locaties zijn alternatieven (OF); andere categorische
    // waarden zijn OF binnen dezelfde categorie. Min/max blijven apart.
    const sleutel=LOCATIE.has(r.veld)?'locatie'
      :NUMERIEK.has(r.veld)?r.id:r.veld;
    groepen.set(sleutel,[...(groepen.get(sleutel)??[]),r]);
  }
  for(const groep of groepen.values()){
    const waarden=groep.map(r=>toetsCriterium(r,object));
    if(waarden.includes('voldoet'))continue;
    const reden=groep.map(label).join(' OF ');
    if(waarden.includes('onbekend'))
      teControleren.push('Harde eis niet volledig controleerbaar: '+reden);
    else hardeAfwijkingen.push('Harde eis niet vervuld: '+reden);
  }
  for(const r of actief.filter(r=>r.sterkte==='uitsluiten')){
    const resultaat=toetsCriterium(r,object);
    if(resultaat==='voldoet')uitsluitingen.push('Uitgesloten: '+label(r));
    else if(resultaat==='onbekend')
      teControleren.push('Uitsluiting niet te controleren: '+label(r));
  }
  for(const r of actief.filter(r=>r.sterkte==='voorkeur')){
    const resultaat=toetsCriterium(r,object);
    if(resultaat==='onbekend'){
      teControleren.push('Voorkeur niet te controleren: '+label(r));
      continue;
    }
    getoetst++;
    if(resultaat==='voldoet'){behaald++;voorkeurenPassend.push(label(r));}
    else voorkeurenAfwijkend.push(label(r));
  }
  const kwalificatie:CriteriumKwalificatie=
    uitsluitingen.length||hardeAfwijkingen.length?'afwijkend'
    :teControleren.length?'te_verifieren':'passend';
  return {kwalificatie,uitsluitingen,hardeAfwijkingen,teControleren,
    voorkeurenPassend,voorkeurenAfwijkend,
    voorkeurScore:{behaald,getoetst}};
}
