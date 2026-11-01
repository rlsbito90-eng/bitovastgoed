import type { Partijprofiel, Relatie, Zoekprofiel, PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';
import { labelPartijprofiel } from '@/lib/relaties/partijprofiel';

/**
 * A15 — evidence suggestions, never assignments. No external lookup, writing,
 * inference from company names, countries, investments or notes.
 */
export type ProfielSuggestie={
  voorstel:Partijprofiel|null;
  bewijs:string;
  bron:'historische_categorie'|'historisch_hoofdtype'|'geen_betrouwbare_bron';
  zekerheid:'gericht_nakijken'|'onvoldoende';
};
export type ClassificatieReview={
  relatieId:string;
  huidigeProfiel:Partijprofiel|null;
  status:'reeds_ingevuld'|'voorstel_controleren'|'onderzoek_nodig';
  suggestie:ProfielSuggestie|null;
  datakwaliteit?:'naam_controleren'|null;
};

export function suggereerPartijprofiel(r:Pick<Relatie,'type'|'partijprofiel'|'investeerderSubtype'>):ProfielSuggestie{
  // Historical type='belegger' was also the database default. Not evidence.
  if(r.investeerderSubtype==='family_office')
    return {voorstel:'family_office',bewijs:'Historische investeerderscategorie: Family office. Verifieer of deze aanduiding nog klopt.',bron:'historische_categorie',zekerheid:'gericht_nakijken'};
  if(r.investeerderSubtype==='fonds')
    return {voorstel:'fonds',bewijs:'Historische investeerderscategorie: Fonds. Controleer de juridische/operationele partij voordat je dit vastlegt.',bron:'historische_categorie',zekerheid:'gericht_nakijken'};
  if(r.type==='ontwikkelaar')
    return {voorstel:'ontwikkelaar',bewijs:'Historisch hoofdtype: Ontwikkelaar. Kan ook een ontwikkelende belegger zijn; eerst beoordelen.',bron:'historisch_hoofdtype',zekerheid:'gericht_nakijken'};
  if(r.type==='makelaar')
    return {voorstel:null,bewijs:'Historisch hoofdtype: Makelaar. Bepaal eerst of de partij makelaar of bemiddelaar is.',bron:'historisch_hoofdtype',zekerheid:'onvoldoende'};
  if(r.type==='eigenaar')
    return {voorstel:null,bewijs:'Historisch hoofdtype: Eigenaar. Dit bewijst nog niet of het om een vastgoedeigenaar, belegger of ondernemer gaat.',bron:'historisch_hoofdtype',zekerheid:'onvoldoende'};
  return {voorstel:null,bewijs:'Geen betrouwbare expliciete classificatie. Een oude belegger-default, strategie, zoekprofiel of vestigingsland is onvoldoende bewijs.',bron:'geen_betrouwbare_bron',zekerheid:'onvoldoende'};
}

/** Stable read-only queue from currently loaded CRM records. Soft-deleted rows
 * excluded by default; no mutation or dispatch to Supabase. */
export function maakClassificatieReview(
  relaties:readonly Pick<Relatie,'id'|'type'|'partijprofiel'|'investeerderSubtype'|'softDeletedAt'|'bedrijfsnaam'>[]
):ClassificatieReview[]{
  return relaties.filter(r=>!r.softDeletedAt).map(r=>{
    if(r.partijprofiel)return {
      relatieId:r.id,huidigeProfiel:r.partijprofiel,status:'reeds_ingevuld',suggestie:null,
    };
    const onduidelijkeNaam=!r.bedrijfsnaam?.trim()||
      /^onbekend(?:e relatie)?$/i.test(r.bedrijfsnaam.trim());
    const suggestie=onduidelijkeNaam
      ?{voorstel:null,bewijs:'Identiteit van de partij eerst vaststellen; er is geen bruikbare bedrijfsnaam. Eventuele bestaande pipeline en contacthistorie blijven behouden.',
        bron:'geen_betrouwbare_bron',zekerheid:'onvoldoende'} as ProfielSuggestie
      :suggereerPartijprofiel(r);
    return {
      relatieId:r.id,huidigeProfiel:null,
      status:suggestie.voorstel?'voorstel_controleren':'onderzoek_nodig',
      suggestie,datakwaliteit:onduidelijkeNaam?'naam_controleren':null,
    };
  });
}
export function tekstProfielSuggestie(s:ProfielSuggestie):string{
  return s.voorstel?labelPartijprofiel(s.voorstel):'Nog geen verantwoord voorstel';
}

/** Prioritering voor het menselijke reviewproces. Gebruikt alleen al geladen
 * CRM-records en schrijft nooit naar de database. Elke bron blijft op eigen plek.
 */
export type PrioritaireClassificatieReview=ClassificatieReview &{
  prioriteit:'hoog'|'regulier';
  actieveZoekprofielen:number;
  pipelineKoppelingen:number;
  contactmomenten:number;
};
export function prioriteerClassificatieReviews(
  relaties:readonly Relatie[],
  zoekprofielen:readonly Zoekprofiel[],
  pipeline:readonly PipelineKandidaat[],
  contactmomenten:readonly ContactMoment[],
):PrioritaireClassificatieReview[]{
  const profiles=new Map<string,number>();
  const koppelingen=new Map<string,number>();
  const momenten=new Map<string,number>();
  for(const z of zoekprofielen)if(z.status==='actief')
    profiles.set(z.relatieId,(profiles.get(z.relatieId)??0)+1);
  for(const k of pipeline)
    koppelingen.set(k.relatieId,(koppelingen.get(k.relatieId)??0)+1);
  for(const m of contactmomenten)
    if(m.relatieId)momenten.set(m.relatieId,(momenten.get(m.relatieId)??0)+1);
  const result=maakClassificatieReview(relaties).map(r=>{
    const actieveZoekprofielen=profiles.get(r.relatieId)??0;
    const pipelineKoppelingen=koppelingen.get(r.relatieId)??0;
    const aantalContactmomenten=momenten.get(r.relatieId)??0;
    return {
      ...r,
      actieveZoekprofielen,pipelineKoppelingen,contactmomenten:aantalContactmomenten,
      prioriteit:(
        (r.datakwaliteit==='naam_controleren'&&pipelineKoppelingen>0)
        ||pipelineKoppelingen>0||actieveZoekprofielen>0
      )?'hoog':'regulier',
    } as PrioritaireClassificatieReview;
  });
  return result.sort((a,b)=>{
    const aHoog=a.prioriteit==='hoog'?1:0, bHoog=b.prioriteit==='hoog'?1:0;
    return bHoog-aHoog
      ||b.pipelineKoppelingen-a.pipelineKoppelingen
      ||b.actieveZoekprofielen-a.actieveZoekprofielen
      ||Number(b.status==='voorstel_controleren')-Number(a.status==='voorstel_controleren')
      ||b.contactmomenten-a.contactmomenten
      ||a.relatieId.localeCompare(b.relatieId);
  });
}
