import type { ContactMoment } from '@/lib/contactMoments';
import type { PipelineKandidaat } from '@/data/mock-data';
import type { AanbiedKanaal } from './aanbiedingRegistreren';

export type AanbiedingsReactieStatus = 'interesse'|'informatie_gevraagd'|'afgewezen'|'geen_reactie';
export type ReactieDuiding = 'koper'|'object'|'onbekend';
export type ReactieReden =
  | 'prijs' | 'rendement' | 'locatie' | 'vastgoedtype' | 'oppervlakte'
  | 'verhuur' | 'onderhoud' | 'financiering' | 'vergunningen'
  | 'risico' | 'timing' | 'documentatie' | 'voorwaarden' | 'anders';

export const REACTIE_STATUS_LABELS:Record<AanbiedingsReactieStatus,string>={
  interesse:'Interesse',informatie_gevraagd:'Aanvullende informatie gevraagd',
  afgewezen:'Afgewezen',geen_reactie:'Nog geen reactie (opvolgsignaal)',
};
export const REACTIE_REDEN_LABELS:Record<ReactieReden,string>={
  prijs:'Vraagprijs / prijsniveau',
  rendement:'Rendement',
  locatie:'Locatie / zoekgebied',
  vastgoedtype:'Vastgoedtype',
  oppervlakte:'Omvang / oppervlakte',
  verhuur:'Verhuursituatie / huurders',
  onderhoud:'Staat / onderhoud',
  financiering:'Financiering',
  vergunningen:'Vergunningen / ontwikkeling',
  risico:'Risico',
  timing:'Timing / aankooptermijn',
  documentatie:'Aanvullende documentatie',
  voorwaarden:'Transactievoorwaarden',
  anders:'Andere reden',
};
export const REACTIE_DUIDING_LABELS:Record<ReactieDuiding,string>={
  koper:'Mogelijk koperspecifiek',
  object:'Mogelijk objectspecifiek',
  onbekend:'Nog niet te bepalen',
};

export interface AanbiedingReactieDetails {
  versie:'1';
  status:AanbiedingsReactieStatus;
  redenen:ReactieReden[];
  duiding:ReactieDuiding;
  kanaal:AanbiedKanaal;
}
export interface ReactieInvoer extends Omit<AanbiedingReactieDetails,'versie'> {
  relatieId:string;
  objectId:string;
  objectTitel:string;
  datum:string;
  notitie?:string;
}
type NieuwMoment=Omit<ContactMoment,'id'|'createdAt'|'updatedAt'|'isSystem'>;
type NieuwKandidaat=Omit<PipelineKandidaat,'id'|'createdAt'|'updatedAt'>;
export interface ReactieOpslag {
  bestaandeKandidaat?:PipelineKandidaat;
  bestaandeMomenten:readonly ContactMoment[];
  maakKandidaat:(k:NieuwKandidaat)=>Promise<PipelineKandidaat|null>;
  voegMomentToe:(m:NieuwMoment)=>Promise<ContactMoment|null>;
  werkKandidaatBij:(id:string,patch:Partial<PipelineKandidaat>)=>Promise<void>;
}
export class ReactiePipelineNietBijgewerkt extends Error {
  constructor(){
    super('Reactie opgeslagen in de tijdlijn, maar de kandidaatstatus kon niet worden bijgewerkt. Controleer de pipeline handmatig.');
    this.name='ReactiePipelineNietBijgewerkt';
  }
}

const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s+'T12:00:00')) &&
  new Date(s+'T12:00:00').toISOString().slice(0,10)===s;

export function controleerReactie(invoer:ReactieInvoer,vandaag:string):string|null{
  if(!invoer.objectId||!invoer.relatieId||!invoer.objectTitel.trim())
    return 'Selecteer een bestaande relatie en een object.';
  if(!validDate(invoer.datum)||invoer.datum>vandaag)
    return 'Vul een geldige, niet-toekomstige registratiedatum in.';
  if(!Object.prototype.hasOwnProperty.call(REACTIE_STATUS_LABELS,invoer.status))
    return 'Ongeldige reactiestatus.';
  if(!Object.prototype.hasOwnProperty.call(REACTIE_DUIDING_LABELS,invoer.duiding))
    return 'Ongeldige duiding.';
  if(!['email','whatsapp','telefoon','linkedin','persoonlijk','anders'].includes(invoer.kanaal))
    return 'Ongeldig contactkanaal.';
  if(invoer.redenen.length>5 || new Set(invoer.redenen).size!==invoer.redenen.length ||
      invoer.redenen.some(r=>!Object.prototype.hasOwnProperty.call(REACTIE_REDEN_LABELS,r)))
    return 'Kies maximaal vijf verschillende geldige redenen.';
  if(invoer.status==='geen_reactie' && (invoer.redenen.length>0 || invoer.duiding!=='onbekend'))
    return 'Zonder reactie is er nog geen reden of oorzaak vastgesteld.';
  return null;
}
export function maakReactieMoment(input:ReactieInvoer):NieuwMoment{
  const intern=input.status==='geen_reactie';
  const kanaalType:Record<AanbiedKanaal,ContactMoment['type']>={
    email:'email',whatsapp:'whatsapp',telefoon:'telefoon',
    linkedin:'linkedin',persoonlijk:'afspraak',anders:'notitie',
  };
  const beschrijving=[
    'Reactie op aanbieding:',
    REACTIE_STATUS_LABELS[input.status],
    input.redenen.length?'Redenen: '+input.redenen.map(r=>REACTIE_REDEN_LABELS[r]).join(', '):'',
    'Duiding: '+REACTIE_DUIDING_LABELS[input.duiding],
    input.notitie?.trim()??'',
  ].filter(Boolean).join('\n');
  return {
    type:intern?'notitie':kanaalType[input.kanaal],
    direction:intern?'intern':'inkomend',
    momentDate:input.datum,
    title:intern?'Geen reactie geregistreerd — '+input.objectTitel
      :'Aanbiedingsreactie: '+REACTIE_STATUS_LABELS[input.status]+' — '+input.objectTitel,
    description:beschrijving,
    relatieId:input.relatieId,
    objectId:input.objectId,
    followUpRequired:false,
    aanbiedingReactie:{
      versie:'1',status:input.status,redenen:input.redenen,
      duiding:input.duiding,kanaal:input.kanaal,
    },
  };
}

const isNieuweKandidaat=(input:ReactieInvoer):NieuwKandidaat=>({
  objectId:input.objectId,
  relatieId:input.relatieId,
  pipelineFase:'match_gevonden',
  interesseNiveau:'lauw',
  teaserVerstuurd:false,
  ndaVerstuurd:false,ndaGetekend:false,informatieGedeeld:false,
  feeAkkoord:false,
});
const VROEGE_FASEN=new Set<PipelineKandidaat['pipelineFase']>([
  'match_gevonden','teaser_verstuurd','interesse_ontvangen',
  'nda_verstuurd','nda_getekend','informatie_gedeeld',
]);
export function reactiePipelinePatch(
  kandidaat:PipelineKandidaat,input:ReactieInvoer,
):Partial<PipelineKandidaat>{
  const patch:Partial<PipelineKandidaat>={};
  // Historische feedback mag latere pipelinecontacten niet terugdateren.
  if(input.status!=='geen_reactie' &&
    (!kandidaat.laatsteContactdatum || input.datum>kandidaat.laatsteContactdatum))
    patch.laatsteContactdatum=input.datum;
  // Een historische reactie mag een inmiddels verder gevorderd traject
  // niet alsnog naar Interesse ontvangen of Afgevallen verplaatsen.
  const historisch=!!kandidaat.laatsteContactdatum &&
    input.datum<kandidaat.laatsteContactdatum;
  if(historisch)return patch;
  if(input.status==='interesse'){
    if(VROEGE_FASEN.has(kandidaat.pipelineFase) &&
      ['match_gevonden','teaser_verstuurd'].includes(kandidaat.pipelineFase))
      patch.pipelineFase='interesse_ontvangen';
    if(VROEGE_FASEN.has(kandidaat.pipelineFase) &&
      (kandidaat.interesseNiveau==='koud'||kandidaat.interesseNiveau==='lauw'))
      patch.interesseNiveau='warm';
  }else if(input.status==='afgewezen' && VROEGE_FASEN.has(kandidaat.pipelineFase)){
    patch.pipelineFase='afgevallen';
    patch.interesseNiveau='koud';
    if(!kandidaat.redenAfgevallen?.trim()){
      const reden=input.redenen.map(r=>REACTIE_REDEN_LABELS[r]).join(', ');
      if(reden)patch.redenAfgevallen=reden;
    }
  }else if(input.status==='informatie_gevraagd'){
    // Vragen om stukken ≠ aankoopinteresse. Geen pipelinepromotie.
    if(!kandidaat.volgendeActie)
      patch.volgendeActie='stukken_delen';
  }
  return patch;
}

export function laatsteReactie(
  relatieId:string,objectId:string,momenten:readonly ContactMoment[],
):ContactMoment|undefined{
  return momenten.filter(m=>m.relatieId===relatieId &&
    m.objectId===objectId && m.aanbiedingReactie?.versie==='1')
    .sort((a,b)=>b.momentDate.localeCompare(a.momentDate) ||
      b.createdAt.localeCompare(a.createdAt))[0];
}

/** Marktfeedback is descriptief en uitsluitend gebaseerd op geregistreerde
 * reacties van verschillende kopers. Laat nooit uit stilte een afwijzing volgen.
 */
export function marktsignaalVoorObject(
  objectId:string,momenten:readonly ContactMoment[],
){
  const laatstePerRelatie=new Map<string,ContactMoment>();
  const openZonderReactie=new Set<string>();
  for(const m of momenten.filter(m=>m.objectId===objectId &&
    m.relatieId && m.aanbiedingReactie?.versie==='1')){
    if(m.aanbiedingReactie?.status==='geen_reactie'){
      openZonderReactie.add(m.relatieId!);
      continue; // Stilte wist een eerder gegeven reactie niet.
    }
    const bestaand=laatstePerRelatie.get(m.relatieId!);
    if(!bestaand || m.momentDate>bestaand.momentDate ||
      (m.momentDate===bestaand.momentDate && m.createdAt>bestaand.createdAt))
      laatstePerRelatie.set(m.relatieId!,m);
  }
  const reacties=[...laatstePerRelatie.values()];
  for(const rid of laatstePerRelatie.keys())openZonderReactie.delete(rid);
  const redenTellingen={} as Partial<Record<ReactieReden,number>>;
  for(const m of reacties.filter(x=>x.aanbiedingReactie?.status==='afgewezen')){
    for(const r of m.aanbiedingReactie?.redenen??[])
      redenTellingen[r]=(redenTellingen[r]??0)+1;
  }
  const patronen=Object.entries(redenTellingen)
    .filter(([,aantal])=>aantal>=3 && reacties.length>=3)
    .map(([reden,aantal])=>({
      reden:reden as ReactieReden,aantal,reacties:reacties.length,
      label:REACTIE_REDEN_LABELS[reden as ReactieReden],
    }))
    .sort((a,b)=>b.aantal-a.aantal);
  return {reacties:reacties.length,
    zonderReactie:openZonderReactie.size,
    afwijzingen:reacties.filter(m=>m.aanbiedingReactie?.status==='afgewezen').length,
    patronen};
}

/** Suggesties over een koper zijn alleen terugkerende, werkelijk vastgelegde
 * antwoorden op verschillende objecten. Het CRM wijzigt het zoekprofiel nooit zelf.
 */
export function koopsignaalVoorRelatie(
  relatieId:string,momenten:readonly ContactMoment[],
){
  const laatstePerObject=new Map<string,ContactMoment>();
  for(const m of momenten.filter(m=>m.relatieId===relatieId && m.objectId &&
    m.aanbiedingReactie?.versie==='1' && m.aanbiedingReactie.status!=='geen_reactie')){
    const old=laatstePerObject.get(m.objectId!);
    if(!old || m.momentDate>old.momentDate ||
      (m.momentDate===old.momentDate && m.createdAt>old.createdAt)){
      laatstePerObject.set(m.objectId!,m);
    }
  }
  const reacties=[...laatstePerObject.values()];
  const redenen={} as Partial<Record<ReactieReden,number>>;
  for(const m of reacties.filter(x=>x.aanbiedingReactie?.status==='afgewezen')){
    for(const reden of m.aanbiedingReactie?.redenen??[]){
      redenen[reden]=(redenen[reden]??0)+1;
    }
  }
  const patronen=Object.entries(redenen)
    .filter(([,aantal])=>aantal>=3 && reacties.length>=3)
    .map(([reden,aantal])=>({
      reden:reden as ReactieReden,
      aantal,reacties:reacties.length,
      label:REACTIE_REDEN_LABELS[reden as ReactieReden],
    }))
    .sort((a,b)=>b.aantal-a.aantal);
  return {reacties:reacties.length,patronen};
}

export async function registreerAanbiedingsReactie(
  input:ReactieInvoer,opslag:ReactieOpslag,vandaag:string,
):Promise<void>{
  const fout=controleerReactie(input,vandaag);
  if(fout)throw new Error(fout);
  if(input.status==='geen_reactie' && !(
    opslag.bestaandeKandidaat?.teaserVerstuurd ||
    opslag.bestaandeKandidaat?.informatieGedeeld ||
    (opslag.bestaandeKandidaat && ['teaser_verstuurd','informatie_gedeeld']
      .includes(opslag.bestaandeKandidaat.pipelineFase))
  ))throw new Error('Registreer eerst de oorspronkelijke aanbieding voordat je ontbrekende reactie vastlegt.');
  if(!opslag.bestaandeKandidaat){
    const toegevoegd=await opslag.maakKandidaat(isNieuweKandidaat(input));
    if(!toegevoegd)throw new Error('Kandidaat kon niet worden gekoppeld.');
    opslag={...opslag,bestaandeKandidaat:toegevoegd};
  }
  const moment=await opslag.voegMomentToe(maakReactieMoment(input));
  if(!moment)throw new Error('Reactiemoment kon niet worden opgeslagen.');
  const patch=reactiePipelinePatch(opslag.bestaandeKandidaat!,input);
  if(Object.keys(patch).length===0)return;
  try{await opslag.werkKandidaatBij(opslag.bestaandeKandidaat!.id,patch);}
  catch{throw new ReactiePipelineNietBijgewerkt();}
}
