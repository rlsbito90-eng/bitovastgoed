import type { Relatie, AssetClass, VastgoedStrategie, Partijprofiel } from '@/data/mock-data';
import type { PropertyType } from '@/hooks/usePropertyTaxonomie';

export type WebsiteVelden = Record<string,string|string[]>;
export interface ReviewIntake {
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  raw_payload: {fields?: WebsiteVelden};
}
const types: Record<string,[string,AssetClass?]> = {
  'Residentieel vastgoed':['residentieel','wonen'],
  'Kantoren':['kantoor','kantoren'],
  'Winkels / retail':['retail','winkels'],
  'Logistiek':['logistiek','logistiek'],
  'Light industrial / bedrijfsruimte':['light_industrial','industrieel'],
  'Mixed-use':['mixed_use','mixed_use'],
  'Zorgvastgoed':['zorg','zorgvastgoed'],
  'Hotel':['leisure','hotels'],
  'Vastgoedportefeuilles':['portefeuille'],
  'Transformatie & herontwikkeling':['transformatie'],
  'Ontwikkellocaties / grond':['ontwikkellocatie','ontwikkellocatie'],
};
const strategies:Record<string,VastgoedStrategie|undefined>={
  'Langjarige exploitatie':'langetermijnbelegging',
  'Value-add / optimalisatie':'value_add',
  'Transformatie':'transformatie',
  'Handel / doorverkoop':'handel',
  'Renovatie':'value_add',
  'Herontwikkeling':'projectontwikkeling',
};
const provincies=new Set(['Noord-Holland','Zuid-Holland','Utrecht','Gelderland','Noord-Brabant','Overijssel','Flevoland','Friesland','Groningen','Drenthe','Limburg','Zeeland']);
export const waardeLijst=(fields:WebsiteVelden,key:string):string[]=>{
  const value=fields[key];
  return Array.isArray(value) ? value.filter(Boolean) : typeof value==='string'&&value.trim()?[value.trim()]:[];
};
export const waardeTekst=(fields:WebsiteVelden,key:string):string=>
  waardeLijst(fields,key).join('; ');
export const geldigeProvincies=(raw:string):string[]=>{
  if(['heel nederland','geheel nederland','nederland','landelijk'].includes(raw.trim().toLowerCase()))return ['Heel Nederland'];
  if(raw.trim().toLowerCase()==='randstad')return ['Randstad'];
  const parts=raw.split(',').map(x=>x.trim()).filter(Boolean);
  return parts.length>0 && parts.every(x=>provincies.has(x)) ? parts : [];
};
/** Voorinvulling voor de beoordelaar, geen geverifieerde geolocatie.
 * Alleen expliciete plaatscombinaties met een schuine streep herkennen;
 * alle originele tekst blijft bewaard, inclusief eventuele onzekerheid.
 */
export function zoekPlaatsenVoorstel(tekst:string):string[] {
  const raw=tekst.trim();
  if(!raw || /\b(?:km|kilometer|minuten|radius|straal|omgeving|regio|tussen|vanaf|rond|landelijk)\b/i.test(raw))return [];
  const delen=raw.split(/\s*\/\s*/);
  if(delen.length<2 || delen.length>4 ||
    !delen.every(naam=>/^[\p{L}][\p{L} .'-]{1,70}$/u.test(naam.trim())) ||
    delen.some(naam=>provincies.has(naam.trim())))return [];
  return [...new Set(delen.map(naam=>naam.trim()))];
}

/** Alleen letterlijke, eenduidige radiusteksten vooraf invullen.
 * Alle overige regio-omschrijvingen blijven vrije tekst en vragen handmatige controle.
 */
export function zoekRadiusVoorstel(tekst:string):Pick<Relatie,'zoekRadiusCentrum'|'zoekRadiusWaarde'|'zoekRadiusEenheid'> {
  const raw=tekst.trim();
  const km=raw.match(/^(\d{1,3})\s*(?:km|kilometer)\s*(?:vanaf|rond|om)\s+([A-Za-zÀ-ÿ .'-]{2,80})$/i);
  if(km) return {zoekRadiusCentrum:km[2].trim(),zoekRadiusWaarde:Number(km[1]),zoekRadiusEenheid:'km_hemelsbreed'};
  const reversed=raw.match(/^([A-Za-zÀ-ÿ .'-]{2,80}),?\s*max(?:imaal)?\.?\s*(\d{1,3})\s*(?:km|kilometer)$/i);
  if(reversed)return {zoekRadiusCentrum:reversed[1].trim(),zoekRadiusWaarde:Number(reversed[2]),zoekRadiusEenheid:'km_hemelsbreed'};
  const minutes=raw.match(/^maximale\s+reistijd\s+van\s+(\d{1,3})\s+minuten\s+vanaf\s+([A-Za-zÀ-ÿ .'-]{2,80})$/i);
  if(minutes)return {zoekRadiusCentrum:minutes[2].trim(),zoekRadiusWaarde:Number(minutes[1]),zoekRadiusEenheid:'minuten_reistijd'};
  return {};
}

const budgetRange=(items:string[]):{budgetMin?:number,budgetMax?:number}=>{
  if(items.length!==1)return {};
  const m=items[0].match(/(?:€\s*)?([\d.]+)\s*[-–]\s*(?:€\s*)?([\d.]+)/);
  if(!m)return {};
  const low=Number(m[1].replace(/\./g,'')),high=Number(m[2].replace(/\./g,''));
  return Number.isSafeInteger(low)&&Number.isSafeInteger(high)&&low>0&&high>=low ? {budgetMin:low,budgetMax:high} : {};
};
export function voorstelNieuweRelatie(i:ReviewIntake, propertyTypes:PropertyType[]):Partial<Relatie>{
  const f=i.raw_payload.fields ?? {};
  const party=waardeLijst(f,'party-type');
  const profiel:Partijprofiel|null=party.length===1?
    party[0]==='Vastgoedbelegger'?'belegger':
    party[0]==='Projectontwikkelaar'?'ontwikkelaar':
    party[0]==='Vastgoedonderneming'?'vastgoedondernemer':null:null;
  const selected=waardeLijst(f,'asset-types').map(v=>types[v]).filter((x):x is [string,AssetClass?]=>!!x);
  const slugs=new Set(selected.map(x=>x[0]));
  const assetClasses=[...new Set(selected.map(x=>x[1]).filter((v):v is AssetClass=>!!v))];
  const strategieen=[...new Set(waardeLijst(f,'strategy').map(x=>strategies[x]).filter((v):v is VastgoedStrategie=>!!v))];
  const gebied=waardeTekst(f,'search-area');
  const company=waardeTekst(f,'company');
  const budget=waardeLijst(f,'investment-size');
  const voorkeuren:Partial<Relatie>={
    bedrijfsnaam: company||i.applicant_name,
    email:i.applicant_email,
    telefoon:i.applicant_phone ?? '',
    type:profiel==='ontwikkelaar'?'ontwikkelaar':profiel==='vastgoedondernemer'?'overig':'belegger',
    partijprofiel:profiel,
    commercialRoles:profiel?['koper']:null,
    leadStatus:'actief',
    bronRelatie:'Investeringsprofiel website (handmatig beoordeeld)',
    assetClasses,propertyTypeIds:propertyTypes.filter(t=>slugs.has(t.slug)).map(t=>t.id),
    regio:geldigeProvincies(gebied),
    zoekPlaatsen:zoekPlaatsenVoorstel(gebied),
    zoekgebiedToelichting:gebied||undefined,
    ...zoekRadiusVoorstel(gebied),
    vastgoedStrategieen:strategieen,
    strategieToelichting:waardeTekst(f,'strategy')||undefined,
    budgetVoorkeurToelichting:budget.join('; ')||undefined,
    rendementsdoelToelichting:waardeTekst(f,'return-target')||undefined,
    aankooptermijn:waardeTekst(f,'purchase-term')||undefined,
    gewensteObjectomvang:waardeTekst(f,'object-size')||undefined,
    gewensteSituatie:waardeLijst(f,'situation'),
    financieringsstructuur:waardeTekst(f,'financing')||undefined,
    financieringsstatus:waardeTekst(f,'financing-status')||undefined,
    besluitvorming:waardeTekst(f,'decision-speed')||undefined,
    aankoopcriteria:waardeTekst(f,'hard-criteria')||undefined,
    uitsluitingen:waardeTekst(f,'dealbreakers')||undefined,
    overigeToelichting:waardeTekst(f,'notes')||undefined,
    ...budgetRange(budget),
  };
  return voorkeuren;
}
export function redenenVoorBeoordeling(i:ReviewIntake,status:string):string[]{
  const f=i.raw_payload.fields ?? {};
  const reasons:string[]=[];
  if(status==='bestaande_relatie')reasons.push('E-mailadres komt overeen met een bestaande relatie; huidige criteria blijven behouden.');
  if(status==='dubbelzinnig')reasons.push('Mogelijke dubbele relatie op naam, bedrijf, telefoon of e-mailadres.');
  if(waardeLijst(f,'party-type').length!==1) reasons.push('Partijtype ontbreekt of is niet eenduidig.');
  if(waardeLijst(f,'asset-types').length===0 || waardeLijst(f,'asset-types').some(x=>!types[x])) reasons.push('Vastgoedsegment ontbreekt of heeft een onbekende keuze.');
  if(waardeLijst(f,'investment-size').length!==1 || !budgetRange(waardeLijst(f,'investment-size')).budgetMin)reasons.push('Budget is niet één herkenbare bandbreedte.');
  if(!geldigeProvincies(waardeTekst(f,'search-area')).length) {
    const plaatsen=zoekPlaatsenVoorstel(waardeTekst(f,'search-area'));
    reasons.push(plaatsen.length
      ? `Mogelijke zoekplaatsen: ${plaatsen.join(', ')}. Controleer of alleen deze steden bedoeld zijn of ook de omgeving.`
      : 'Zoekgebied is een plaats, straal, reistijd of vrij omschreven gebied; handmatig verifiëren.');
  }
  if(!waardeLijst(f,'privacy').includes('1'))reasons.push('Formulierprivacytoestemming is niet vast te stellen.');
  return reasons.length?reasons:['Handmatige beoordeling nodig; originele antwoorden controleren.'];
}
