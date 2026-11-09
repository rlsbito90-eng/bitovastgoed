import type { Relatie, RelatieContactpersoon } from '@/data/mock-data';

export type DubbelSignaal = 'e-mail'|'telefoon'|'LinkedIn-profiel'|'naam en bedrijf';
export interface InvoerContact {
  bedrijfsnaam?: string|null;
  contactpersoon?: string|null;
  email?: string|null;
  telefoon?: string|null;
  linkedinUrl?: string|null;
}
export interface GevondenRelatie {
  relatie: Relatie;
  redenen: DubbelSignaal[];
}
const normaliseer=(s?:string|null)=> (s??'').trim().toLocaleLowerCase('nl-NL');
const telSleutel=(s?:string|null)=> {
  const nummers=(s??'').replace(/[^0-9]/g,'');
  return nummers.length>=9?nummers.slice(-9):'';
};
/** Vergelijk alleen de stabiele LinkedIn-padidentiteit; bewaar de originele URL. */
export function linkedinSleutel(url?:string|null):string {
  if(!url?.trim())return '';
  try {
    const value=/^https?:\/\//i.test(url.trim())?url.trim():`https://${url.trim()}`;
    const link=new URL(value);
    const host=link.hostname.replace(/^www\./,'').toLowerCase();
    const path=decodeURIComponent(link.pathname).replace(/\/+$/,'').toLowerCase();
    if(!['linkedin.com','nl.linkedin.com','uk.linkedin.com'].includes(host)||
      !/^\/(in|pub)\/[^/]+/.test(path))return '';
    return path.replace(/^\/pub\//,'/in/');
  }catch{return ''}
}
export function isGeldigeLinkedinProfielUrl(input:string):boolean {
  return !input.trim()||!!linkedinSleutel(input);
}
export function vindMogelijkeRelaties(
  candidate:InvoerContact, relaties:Relatie[], contactpersonen:RelatieContactpersoon[]=[],
):GevondenRelatie[]{
  const email=normaliseer(candidate.email);
  const phone=telSleutel(candidate.telefoon);
  const url=linkedinSleutel(candidate.linkedinUrl);
  const naam=normaliseer(candidate.contactpersoon);
  const bedrijf=normaliseer(candidate.bedrijfsnaam);
  return relaties.filter(r=>!r.softDeletedAt).flatMap(relatie=>{
    const personen=contactpersonen.filter(c=>c.relatieId===relatie.id);
    const redenen:DubbelSignaal[]=[];
    if(email&&(normaliseer(relatie.email)===email||personen.some(p=>normaliseer(p.email)===email)))
      redenen.push('e-mail');
    if(phone&&(telSleutel(relatie.telefoon)===phone||
       personen.some(p=>telSleutel(p.telefoon)===phone||telSleutel(p.telefoonMobiel)===phone)))
      redenen.push('telefoon');
    if(url&&(linkedinSleutel(relatie.linkedinUrl)===url||
       personen.some(p=>linkedinSleutel(p.linkedinUrl)===url)))
      redenen.push('LinkedIn-profiel');
    if(naam&&bedrijf&&normaliseer(relatie.bedrijfsnaam)===bedrijf&&(
      normaliseer(relatie.contactpersoon)===naam||personen.some(p=>normaliseer(p.naam)===naam)))
      redenen.push('naam en bedrijf');
    return redenen.length?[{relatie,redenen}]:[];
  });
}
export function zijnDezelfdeInvoer(a:InvoerContact,b:InvoerContact):boolean{
  const email=normaliseer(a.email),phone=telSleutel(a.telefoon),url=linkedinSleutel(a.linkedinUrl);
  if(email&&email===normaliseer(b.email))return true;
  if(phone&&phone===telSleutel(b.telefoon))return true;
  if(url&&url===linkedinSleutel(b.linkedinUrl))return true;
  return !!(normaliseer(a.contactpersoon)&&normaliseer(a.bedrijfsnaam)&&
    normaliseer(a.contactpersoon)===normaliseer(b.contactpersoon)&&
    normaliseer(a.bedrijfsnaam)===normaliseer(b.bedrijfsnaam));
}
