import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';

export interface AanbiedGolf {
  id:string;objectId:string;volgnummer:number;toelichting?:string;aangemaaktOp:string;
}
export interface GolfSelectie {
  id:string;golfId:string;objectId:string;kandidaatId:string;geselecteerdOp:string;
}
export type GolfKandidaatStatus =
  'niet_benaderd'|'datum_onbekend'|'wachten'|'opvolgen'|'gereageerd';
export const GOLF_STATUS_LABELS:Record<GolfKandidaatStatus,string>={
  niet_benaderd:'Geselecteerd, nog niet aangeboden',
  datum_onbekend:'Aangeboden, datum onbekend',
  wachten:'Aangeboden, reactie afwachten',
  opvolgen:'Aangeboden, opvolgen',
  gereageerd:'Reactie geregistreerd',
};
export interface GolfKandidaatVoortgang {
  kandidaatId:string;status:GolfKandidaatStatus;
  laatsteAanbieddatum?:string;laatsteReactiedatum?:string;
  reactiestatus?:string;
}
export interface GolfVoortgang {
  aantal:number;nietBenaderd:number;wachten:number;opvolgen:number;
  gereageerd:number;datumOnbekend:number;
  vervolgadvies:string;
  leden:GolfKandidaatVoortgang[];
}

const dateOnly=(v?:string)=>v?.slice(0,10)??'';
const geldigDatum=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v);
const kalenderDagen=(van:string,tot:string)=>{
  const d1=Date.parse(van+'T12:00:00Z'),d2=Date.parse(tot+'T12:00:00Z');
  return Number.isFinite(d1)&&Number.isFinite(d2)
    ?Math.floor((d2-d1)/86400000):0;
};

/** Alle staten komen uit bestaande kandidaatvelden en contactmomenten.
 * Selectie voor een golf telt niet als verstuurd of afgewezen.
 */
export function bepaalGolfKandidaatStatus(
  kandidaat:PipelineKandidaat,
  contactmomenten:readonly ContactMoment[],
  vandaag:string,
  opvolgNaDagen=5,
):GolfKandidaatVoortgang{
  const events=contactmomenten.filter(m=>
    m.objectId===kandidaat.objectId&&m.relatieId===kandidaat.relatieId);
  const aanbod=events.filter(m=>m.direction==='uitgaand' &&
    (m.type==='teaser_verstuurd'||m.type==='informatie_gedeeld'));
  const dates=[
    kandidaat.teaserVerstuurdOp,kandidaat.informatieGedeeldOp,
    ...aanbod.map(m=>m.momentDate),
  ].map(dateOnly).filter(geldigDatum).sort();
  const laatsteAanbieddatum=dates.length>0?dates[dates.length-1]:undefined;
  const isAangeboden=kandidaat.teaserVerstuurd || kandidaat.informatieGedeeld ||
    aanbod.length>0 || ['teaser_verstuurd','informatie_gedeeld'].includes(kandidaat.pipelineFase);
  if(!isAangeboden){
    return {kandidaatId:kandidaat.id,status:'niet_benaderd'};
  }
  if(!laatsteAanbieddatum){
    return {kandidaatId:kandidaat.id,status:'datum_onbekend'};
  }
  const reacties=events.filter(m=>m.aanbiedingReactie?.versie==='1' &&
    m.aanbiedingReactie.status!=='geen_reactie' &&
    geldigDatum(dateOnly(m.momentDate)))
    .sort((a,b)=>dateOnly(b.momentDate).localeCompare(dateOnly(a.momentDate))||
      b.createdAt.localeCompare(a.createdAt));
  const laatsteReactie=reacties[0];
  if(laatsteReactie && dateOnly(laatsteReactie.momentDate)>=laatsteAanbieddatum){
    return {
      kandidaatId:kandidaat.id,status:'gereageerd',
      laatsteAanbieddatum,laatsteReactiedatum:dateOnly(laatsteReactie.momentDate),
      reactiestatus:laatsteReactie.aanbiedingReactie?.status,
    };
  }
  const status:GolfKandidaatStatus=kalenderDagen(laatsteAanbieddatum,vandaag)>=opvolgNaDagen
    ?'opvolgen':'wachten';
  return {kandidaatId:kandidaat.id,status,laatsteAanbieddatum};
}

/** Niet sturen = geen markttoets. Geen reactie is nooit een impliciete nee.
 * Adviezen zijn waarschuwingen, geen automatische blokkerende workflow.
 */
export function berekenGolfVoortgang(
  kandidaten:readonly PipelineKandidaat[],
  contactmomenten:readonly ContactMoment[],
  vandaag:string,
):GolfVoortgang{
  const leden=kandidaten.map(k=>bepaalGolfKandidaatStatus(
    k,contactmomenten,vandaag));
  const aantal=leden.length;
  const tel=(status:GolfKandidaatStatus)=>leden.filter(k=>k.status===status).length;
  const nietBenaderd=tel('niet_benaderd');
  const wachten=tel('wachten');
  const opvolgen=tel('opvolgen');
  const gereageerd=tel('gereageerd');
  const datumOnbekend=tel('datum_onbekend');
  let vervolgadvies:string;
  if(nietBenaderd>0)
    vervolgadvies='Niet alle geselecteerde kopers zijn daadwerkelijk benaderd. Registreer eerst de aanbieding.';
  else if(datumOnbekend>0)
    vervolgadvies='Controleer de werkelijke verzenddatum voordat je een volgende golf beoordeelt.';
  else if(opvolgen>0)
    vervolgadvies='Er staan reacties open na de opvolgtermijn. Volg eerst deze beleggers op; stilte is geen afwijzing.';
  else if(wachten>0)
    vervolgadvies='Er worden nog reacties afgewacht. Breder aanbieden kan, maar beoordeel eerst de lopende markttoets.';
  else if(gereageerd>0)
    vervolgadvies='Alle geselecteerde kopers hebben gereageerd. Beoordeel hun redenen voordat je de volgende golf start.';
  else
    vervolgadvies='Er zijn nog geen kandidaten in deze golf.';
  return {aantal,nietBenaderd,wachten,opvolgen,gereageerd,
    datumOnbekend,vervolgadvies,leden};
}

export function valideerNieuweGolf(
  gekozenIds:readonly string[],
  beschikbareKandidaten:readonly PipelineKandidaat[],
  bestaandeSelecties:readonly GolfSelectie[],
):string|null{
  if(gekozenIds.length<1||gekozenIds.length>3)
    return 'Selecteer per golf één tot drie kandidaatrelaties.';
  if(new Set(gekozenIds).size!==gekozenIds.length)
    return 'Een kandidaat mag slechts één keer in een golf voorkomen.';
  const kandidaatSet=new Set(beschikbareKandidaten.map(x=>x.id));
  if(gekozenIds.some(id=>!kandidaatSet.has(id)))
    return 'Alle geselecteerde kandidaten moeten eerst aan het object gekoppeld zijn.';
  const gekozenInGolven=new Set(bestaandeSelecties.map(x=>x.kandidaatId));
  if(gekozenIds.some(id=>gekozenInGolven.has(id)))
    return 'Een kandidaat die al in een eerdere golf zit, kan niet opnieuw worden geselecteerd.';
  return null;
}
