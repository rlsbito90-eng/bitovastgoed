import { INTERESSE_LABELS, PIPELINE_FASES, type InteresseNiveau, type PipelineFase } from '@/data/mock-data';
import { REACTIE_REDEN_LABELS, type ReactieReden } from '@/lib/relaties/aanbiedingsReacties';
import type { SorteerbareKandidaat } from '@/lib/pipeline/kandidaatSortering';

export interface ProefKandidaat extends SorteerbareKandidaat {
  naam: string;
  matchscore: number | null;
  laatsteContactdatum: string;
  volgendeActieDatum: string | null;
  afwijzing?: {
    bron: 'intern' | 'koper';
    categorie: ReactieReden;
    anders?: string;
  };
}
export type BulkProefActie =
  | {type:'fase';fase:Exclude<PipelineFase,'afgevallen'|'afgerond'>}
  | {type:'interesse';niveau:InteresseNiveau}
  | {type:'afwijzen';bron:'intern';categorie:ReactieReden;anders?:string};

export interface BulkProefResultaat {
  kandidaten: ProefKandidaat[];
  aangepast: number;
  ongewijzigd: number;
  gewijzigdeIds: string[];
  fout: string | null;
}

export function fictieveKandidaten():ProefKandidaat[]{
  return [
    {id:'a',naam:'Belegger A',matchscore:96,pipelineFase:'interesse_ontvangen',
      interesseNiveau:'warm',laatsteContactdatum:'2026-11-14',volgendeActieDatum:'2026-11-17'},
    {id:'b',naam:'Belegger B',matchscore:92,pipelineFase:'informatie_gedeeld',
      interesseNiveau:'zeer_warm',laatsteContactdatum:'2026-11-12',volgendeActieDatum:'2026-11-19'},
    {id:'c',naam:'Belegger C',matchscore:87,pipelineFase:'match_gevonden',
      interesseNiveau:'lauw',laatsteContactdatum:'2026-11-10',volgendeActieDatum:null},
    {id:'d',naam:'Belegger D',matchscore:81,pipelineFase:'bezichtiging_gepland',
      interesseNiveau:'warm',laatsteContactdatum:'2026-11-13',volgendeActieDatum:'2026-11-20'},
    {id:'e',naam:'Belegger E',matchscore:78,pipelineFase:'teaser_verstuurd',
      interesseNiveau:'lauw',laatsteContactdatum:'2026-11-09',volgendeActieDatum:null},
    {id:'f',naam:'Belegger F',matchscore:65,pipelineFase:'match_gevonden',
      interesseNiveau:'koud',laatsteContactdatum:'2026-11-08',volgendeActieDatum:'2026-11-21'},
    {id:'g',naam:'Belegger G',matchscore:94,pipelineFase:'afgevallen',
      interesseNiveau:'koud',laatsteContactdatum:'2026-11-11',volgendeActieDatum:null,
      afwijzing:{bron:'koper',categorie:'prijs'}},
    {id:'h',naam:'Belegger H',matchscore:48,pipelineFase:'afgevallen',
      interesseNiveau:'koud',laatsteContactdatum:'2026-11-07',volgendeActieDatum:null,
      afwijzing:{bron:'intern',categorie:'locatie'}},
  ];
}

/**
 * Één zuivere, alles-of-niets berekening, zonder database- of contactregistratie.
 * Een kopersreactie mag nooit als identieke massareactie worden aangemaakt.
 * Afgevallen en afgeronde trajecten blijven onaangetast.
 */
export function pasFictieveBulkActieToe(
  kandidaten:readonly ProefKandidaat[],
  geselecteerd:ReadonlySet<string>,
  actie:BulkProefActie,
):BulkProefResultaat{
  const fout=(message:string):BulkProefResultaat=>({
    kandidaten:[...kandidaten],aangepast:0,ongewijzigd:0,gewijzigdeIds:[],fout:message,
  });
  if(geselecteerd.size===0)return fout('Selecteer eerst minimaal één kandidaat.');
  if(geselecteerd.size>kandidaten.length||[...geselecteerd].some(id=>!kandidaten.some(k=>k.id===id)))
    return fout('De selectie bevat een kandidaat die niet meer in de lijst staat.');
  if(kandidaten.some(k=>geselecteerd.has(k.id)&&k.pipelineFase==='afgevallen'))
    return fout('Een afgevallen kandidaat kun je niet via een bulkactie opnieuw activeren of overschrijven.');
  if(kandidaten.some(k=>geselecteerd.has(k.id)&&k.pipelineFase==='afgerond'))
    return fout('Een afgerond traject kan niet via bulkbewerking worden gewijzigd.');

  if(actie.type==='afwijzen'){
    // Ook tegen een onjuist aangeroepen JavaScript-client beschermen.
    if(actie.bron!=='intern')
      return fout('Ontvangen kopersreacties moet je afzonderlijk per belegger registreren.');
    if(!Object.prototype.hasOwnProperty.call(REACTIE_REDEN_LABELS,actie.categorie))
      return fout('Kies eerst één geldige afwijzingscategorie.');
    if(actie.categorie==='anders'&&!actie.anders?.trim())
      return fout('Vul bij Andere reden een korte toelichting in.');
    if((actie.anders?.length??0)>500)
      return fout('De toelichting mag maximaal 500 tekens zijn.');
  }else if(actie.type==='fase'){
    if(!PIPELINE_FASES.some(f=>f.key===actie.fase)||
       ['afgevallen','afgerond'].includes(actie.fase))
      return fout('Afvallen en afronden zijn afzonderlijke acties, niet een gewone fasewijziging.');
  }else if(actie.type==='interesse'){
    if(!Object.prototype.hasOwnProperty.call(INTERESSE_LABELS,actie.niveau))
      return fout('Ongeldig interesseniveau.');
  }else{
    return fout('Onbekende bulkactie.');
  }
  const gewijzigdeIds:string[]=[];
  const nieuw=kandidaten.map(k=>{
    if(!geselecteerd.has(k.id))return k;
    if(actie.type==='fase'){
      if(k.pipelineFase===actie.fase)return k;
      gewijzigdeIds.push(k.id);
      return {...k,pipelineFase:actie.fase};
    }
    if(actie.type==='interesse'){
      if(k.interesseNiveau===actie.niveau)return k;
      gewijzigdeIds.push(k.id);
      return {...k,interesseNiveau:actie.niveau};
    }
    gewijzigdeIds.push(k.id);
    return {
      ...k,pipelineFase:'afgevallen' as const,interesseNiveau:'koud' as const,
      afwijzing:{
        bron:'intern' as const,categorie:actie.categorie,
        ...(actie.categorie==='anders'?{anders:actie.anders?.trim()}:{}),
      },
    };
  });
  return {
    kandidaten:nieuw,aangepast:gewijzigdeIds.length,
    ongewijzigd:geselecteerd.size-gewijzigdeIds.length,gewijzigdeIds,fout:null,
  };
}
