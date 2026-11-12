import type { ObjectVastgoed } from '@/data/mock-data';

/**
 * Commerciële intake van een object. De bestaande objecten-tabel is leidend
 * voor vraagprijs, marktwaarde-indicatie, bron en verkoopmotivatie.
 */
export type PrijsOordeel = 'onbekend'|'realistisch'|'ambitieus'|'herzien';
export type VerkoopBereidheid = 'onbekend'|'verkennend'|'bereid'|'bevestigd';
export type VerkoopTermijn = 'onbekend'|'spoed'|'binnen_3m'|'binnen_6m'|'flexibel';
export type PrijsFlexibiliteit = 'onbekend'|'vast'|'bespreekbaar'|'ruim';
export type BeslisserStatus = 'onbekend'|'bevoegd'|'mede_beslissers'|'tussenpersoon';
export type EerderAangeboden = 'onbekend'|'nee'|'ja';
export type InformatieStatus = 'onbekend'|'basis'|'voldoende'|'geverifieerd';
export type AanbiedAdvies = 'verkennen'|'markttoets'|'actief'|'herbeoordelen';

export interface ObjectCommercieleBeoordeling {
  objectId:string;
  prijsOordeel:PrijsOordeel;
  verkoopBereidheid:VerkoopBereidheid;
  verkoopTermijn:VerkoopTermijn;
  prijsFlexibiliteit:PrijsFlexibiliteit;
  beslisserStatus:BeslisserStatus;
  eerderAangeboden:EerderAangeboden;
  eerderAangebodenToelichting?:string;
  informatieStatus:InformatieStatus;
  internOordeel?:string;
  besluit?:AanbiedAdvies;
  besluitToelichting?:string;
  bijgewerktOp?:string;
}
export const LEEG_BEOORDELING = {
  prijsOordeel:'onbekend',
  verkoopBereidheid:'onbekend',
  verkoopTermijn:'onbekend',
  prijsFlexibiliteit:'onbekend',
  beslisserStatus:'onbekend',
  eerderAangeboden:'onbekend',
  informatieStatus:'onbekend',
} as const satisfies Omit<ObjectCommercieleBeoordeling,
  'objectId'|'eerderAangebodenToelichting'|'internOordeel'|'besluit'|'besluitToelichting'|'bijgewerktOp'>;

export const PRIJS_OORDEEL_LABELS:Record<PrijsOordeel,string>={
  onbekend:'Nog niet beoordeeld',realistisch:'Realistisch',
  ambitieus:'Ambitieus (gericht toetsen)',herzien:'Eerst prijs herbeoordelen',
};
export const VERKOOP_BEREIDHEID_LABELS:Record<VerkoopBereidheid,string>={
  onbekend:'Onbekend',verkennend:'Oriënterend',bereid:'Bereid tot verkoop',
  bevestigd:'Concreet verkoopbesluit',
};
export const VERKOOP_TERMIJN_LABELS:Record<VerkoopTermijn,string>={
  onbekend:'Onbekend',spoed:'Zo snel mogelijk',
  binnen_3m:'Binnen drie maanden',binnen_6m:'Binnen zes maanden',
  flexibel:'Flexibel / geen harde termijn',
};
export const PRIJS_FLEXIBILITEIT_LABELS:Record<PrijsFlexibiliteit,string>={
  onbekend:'Onbekend',vast:'Prijs is vast',
  bespreekbaar:'Bespreekbaar',ruim:'Ruimte bij passend voorstel',
};
export const BESLISSER_LABELS:Record<BeslisserStatus,string>={
  onbekend:'Nog niet bevestigd',bevoegd:'Bevoegde beslisser gesproken',
  mede_beslissers:'Meerdere beslissers betrokken',
  tussenpersoon:'Contact via tussenpersoon',
};
export const EERDER_AANGEBODEN_LABELS:Record<EerderAangeboden,string>={
  onbekend:'Onbekend',nee:'Nog niet eerder aangeboden',
  ja:'Wel eerder aangeboden',
};
export const INFORMATIE_LABELS:Record<InformatieStatus,string>={
  onbekend:'Nog niet beoordeeld',
  basis:'Basisinformatie (deels) beschikbaar',
  voldoende:'Voldoende voor gerichte aanbieding',
  geverifieerd:'Belangrijkste stukken gecontroleerd',
};
export const AANBIED_ADVIES_LABELS:Record<AanbiedAdvies,string>={
  verkennen:'Eerst verkennen',
  markttoets:'Gerichte markttoets',
  actief:'Actief aanbieden',
  herbeoordelen:'Eerst herbeoordelen',
};

export interface CommercieelAdvies {
  voorgesteld:AanbiedAdvies;
  gekozen:AanbiedAdvies;
  handmatig:boolean;
  redenen:string[];
  prijsverschilPct?:number;
  informatieOntbreekt:string[];
}

export function prijsverschilMetIndicatie(
  vraagprijs?:number|null, marktwaardeIndicatie?:number|null,
):number|undefined{
  if(typeof vraagprijs!=='number'||!Number.isFinite(vraagprijs)||vraagprijs<=0 ||
     typeof marktwaardeIndicatie!=='number'||!Number.isFinite(marktwaardeIndicatie)||
     marktwaardeIndicatie<=0)return undefined;
  return ((vraagprijs-marktwaardeIndicatie)/marktwaardeIndicatie)*100;
}

/** Alleen een advies en verificatiepunten. Geen taxatie, harde verkoopblokkade,
 * automatische aanbiedingsmail of statuswijziging van het object.
 */
export function bepaalCommercieelAdvies(
  object:Pick<ObjectVastgoed,
    'vraagprijs'|'prijsindicatie'|'marktwaardeIndicatie'|'marktwaardeBron'|'verkoopmotivatie'>,
  beoordeling:Partial<ObjectCommercieleBeoordeling>|null,
):CommercieelAdvies{
  const b={...LEEG_BEOORDELING,...(beoordeling??{})};
  const prijsverschilPct=prijsverschilMetIndicatie(
    object.vraagprijs,object.marktwaardeIndicatie,
  );
  const informatieOntbreekt:string[]=[];
  if(!object.vraagprijs && !object.prijsindicatie?.trim())
    informatieOntbreekt.push('Vraagprijs of prijsindicatie ontbreekt');
  if(!object.marktwaardeIndicatie || !object.marktwaardeBron?.trim())
    informatieOntbreekt.push('Eigen waarde-inschatting met bron ontbreekt');
  if(!object.verkoopmotivatie?.trim())
    informatieOntbreekt.push('Verkoopmotivatie niet vastgelegd');
  if(b.verkoopBereidheid==='onbekend'||b.verkoopBereidheid==='verkennend')
    informatieOntbreekt.push('Verkoopbereidheid nog niet bevestigd');
  if(b.beslisserStatus!=='bevoegd')
    informatieOntbreekt.push('Beslissingsbevoegdheid nog niet bevestigd');
  if(b.informatieStatus==='onbekend'||b.informatieStatus==='basis')
    informatieOntbreekt.push('Dossierstukken nog niet voldoende gecontroleerd');

  let voorgesteld:AanbiedAdvies='verkennen';
  const redenen:string[]=[];
  if(b.prijsOordeel==='herzien'){
    voorgesteld='herbeoordelen';
    redenen.push('Je hebt aangegeven dat de prijs eerst moet worden herbeoordeeld.');
  }else if(b.prijsOordeel==='ambitieus' &&
    (b.verkoopBereidheid==='onbekend'||b.verkoopBereidheid==='verkennend')){
    voorgesteld='herbeoordelen';
    redenen.push('Ambitieuze prijs gecombineerd met onduidelijke verkoopbereidheid.');
  }else if(b.verkoopBereidheid==='onbekend'||b.verkoopBereidheid==='verkennend'){
    voorgesteld='verkennen';
    redenen.push('Verkoopbereidheid is nog niet concreet.');
  }else if(b.prijsOordeel==='realistisch' &&
    b.verkoopBereidheid==='bevestigd' &&
    b.beslisserStatus==='bevoegd' &&
    (b.informatieStatus==='voldoende'||b.informatieStatus==='geverifieerd') &&
    (!!object.vraagprijs||!!object.prijsindicatie?.trim())){
    voorgesteld='actief';
    redenen.push('Prijs beoordeeld, concreet verkoopbesluit en voldoende informatie.');
  }else{
    voorgesteld='markttoets';
    redenen.push('Er is verkoopbereidheid; toets de propositie eerst selectief.');
    if(b.prijsOordeel==='ambitieus')
      redenen.push('Een ambitieuze prijs vraagt om extra zorgvuldige marktfeedback.');
  }
  if(prijsverschilPct!==undefined && prijsverschilPct>20)
    redenen.push('Vraagprijs ligt meer dan 20% boven de ingevoerde waarde-indicatie; controleer de onderbouwing.');

  return {
    voorgesteld,
    gekozen:b.besluit??voorgesteld,
    handmatig:!!b.besluit,
    redenen,
    informatieOntbreekt,
    prijsverschilPct,
  };
}
export function valideerCommercieleBeoordeling(
  b:Omit<ObjectCommercieleBeoordeling,'objectId'>,
):string|null{
  if(b.besluit && !b.besluitToelichting?.trim())
    return 'Licht een handmatige afwijking van het advies kort toe.';
  if(b.eerderAangeboden==='ja' && !b.eerderAangebodenToelichting?.trim())
    return 'Noteer waar en wanneer het object eerder in de markt is gebracht.';
  for(const field of [
    b.eerderAangebodenToelichting,b.internOordeel,b.besluitToelichting,
  ])if((field?.length??0)>2000)return 'Een toelichting mag maximaal 2.000 tekens bevatten.';
  return null;
}
