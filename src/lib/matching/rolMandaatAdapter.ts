/**
 * Bito CRM — R2 candidate read adapter (v0.6).
 * PURE read model: no DB calls, no localStorage, no transmissions or writes.
 * Designed for input from existing useDataStore Relatie, Zoekprofiel, ObjectVastgoed.
 * All optional fields are FUTURE (not yet present in production database).
 */

export type CommercieleRol = 'koper' | 'verkoper' | 'bemiddelaar' | 'beheerder' | 'adviseur' | 'financier' | 'overig';
export type MandaatType = 'eigen_aankoop' | 'namens_opdrachtgever' | 'voor_netwerk' | 'onbekend';
export type MatchKwalificatie = 'passend' | 'te_verifieren' | 'afwijkend' | 'onvoldoende';
export type ContactRoute = 'directe_koper' | 'via_bemiddelaar';
export type ObjectAvailability = 'aanbiedbaar' | 'niet_aanbiedbaar';

export interface CrmRelatieInput {
  id: string;
  type?: string;
  softDeletedAt?: string | null;
  commercialRoles?: readonly CommercieleRol[] | null; // Future nullable field; null = legacy unknown, [] = explicitly none
  assetClasses?: readonly string[] | null;
  propertyTypeIds?: readonly string[] | null;
  propertySubtypeIds?: readonly string[] | null;
  dealTypeIds?: readonly string[] | null;
  regio?: readonly string[] | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  aankoopcriteria?: string | null;
}
export interface CrmMandaatInput {
  id: string;
  relatieId: string;
  status: string;
  naam?: string;
  typeVastgoed?: readonly string[] | null;
  propertyTypeIds?: readonly string[] | null;
  propertySubtypeIds?: readonly string[] | null;
  dealTypeIds?: readonly string[] | null;
  regio?: readonly string[] | null;
  steden?: readonly string[] | null;
  prijsMin?: number | null;
  prijsMax?: number | null;
  mandateType?: MandaatType | null; // Future field
  mandateConfirmed?: boolean | null; // Future field
  principalRelatieId?: string | null; // Future field: do NOT assume seller/buyer identity from contact.
  principalVerified?: boolean | null; // Future field
}
export interface CrmObjectInput {
  id: string;
  status: string;
  softDeletedAt?: string | null;
  isArchived?: boolean | null;
  type?: string;
  propertyTypeId?: string | null;
  propertySubtypeIds?: readonly string[] | null;
  dealTypeIds?: readonly string[] | null;
  vraagprijs?: number | null;
  plaats?: string | null;
  provincie?: string | null;
}
export interface MatchToelichting {
  matcht: string[];
  controleer: string[];
  afwijkend: string[];
}
export interface ProfielRoute {
  /** Stable key in read model. For relation virtual profile do not persist as UUID. */
  key: string;
  zoekprofielId: string | null;
  bron: 'relatie_basis' | 'zoekprofiel';
  naam: string;
  route: ContactRoute;
  kwalificatie: MatchKwalificatie;
  bevestiging: 'bevestigd' | 'te_verifieren';
  koperRelatieId: string | null;
  redenVanRoute: string;
  toelichting: MatchToelichting;
}
export interface KandidaatVoorstel {
  /** One row for every contact relation, never a fabricated buyer relation. */
  relatieId: string;
  besteRoute: ProfielRoute;
  alleRoutes: ProfielRoute[];
  aandachtNodig: boolean;
  /** A suggestion is never consent to send information. */
  kanAutomatischVersturen: false;
  kanAutomatischBodMaken: false;
}

const gevuld = (a?: readonly unknown[] | null): a is readonly unknown[] => !!a && a.length > 0;
const getRoles = (r: CrmRelatieInput) => Array.isArray(r.commercialRoles) ? r.commercialRoles : null;
const has = (roles: readonly CommercieleRol[] | null, role: CommercieleRol) => roles?.includes(role) === true;
const overlap = (a?: readonly string[] | null, b?: readonly string[] | null) => !!a && !!b && a.some(x => b.includes(x));

/** Availability applies only to *new* proactive suggestions, not historical candidate lists. */
export function isAanbiedbaar(o: CrmObjectInput): boolean {
  return o.status === 'beschikbaar' && !o.isArchived && !o.softDeletedAt;
}

function heeftBasisCriteria(r: CrmRelatieInput): boolean {
  return !!(gevuld(r.propertyTypeIds) || gevuld(r.assetClasses) ||
    gevuld(r.propertySubtypeIds) || gevuld(r.dealTypeIds) ||
    gevuld(r.regio) || r.budgetMin != null || r.budgetMax != null);
}

function routeType(r: CrmRelatieInput, p?: CrmMandaatInput): { route: ContactRoute; reden: string; mandaatType: MandaatType } | null {
  const roles = getRoles(r);
  if (!p) {
    // General Relaties criteria are never an intermediary mandate.
    if (roles && !has(roles, 'koper')) return null;
    if (!roles && !['belegger', 'ontwikkelaar'].includes(r.type ?? '')) return null;
    if (!heeftBasisCriteria(r)) return null;
    return {route: 'directe_koper', reden:'algemene aankoopcriteria', mandaatType:'eigen_aankoop'};
  }
  if (p.status !== 'actief') return null;
  const mt: MandaatType = p.mandateType ?? 'onbekend';
  if (mt === 'eigen_aankoop') {
    if (roles && !has(roles, 'koper')) return null;
    return {route:'directe_koper',reden:'eigen aankoop',mandaatType:mt};
  }
  if (mt === 'namens_opdrachtgever' || mt === 'voor_netwerk') {
    if (roles && !has(roles, 'bemiddelaar')) return null;
    return {route:'via_bemiddelaar',reden:mt === 'voor_netwerk' ? 'kopersnetwerk' : 'namens opdrachtgever',mandaatType:mt};
  }
  // Existing profiles do not encode mandate kind. Never infer broker as purchaser.
  const broker = has(roles,'bemiddelaar') || (!roles && r.type === 'makelaar');
  if (broker) return {route:'via_bemiddelaar',reden:'oud profiel: opdrachtsoort onbekend',mandaatType:'onbekend'};
  if (roles && !has(roles,'koper')) return null;
  return {route:'directe_koper',reden:'oud profiel: eigen aankoop nog te bevestigen',mandaatType:'onbekend'};
}

function beoordelen(o: CrmObjectInput,r: CrmRelatieInput, relaties:readonly CrmRelatieInput[], p?:CrmMandaatInput):ProfielRoute|null {
  const route = routeType(r,p); if(!route) return null;
  const matcht:string[]=[],controleer:string[]=[],afwijkend:string[]=[];
  const types = p ? p.propertyTypeIds : r.propertyTypeIds;
  const legacy = p ? p.typeVastgoed : r.assetClasses;
  const subtypes = p ? p.propertySubtypeIds : r.propertySubtypeIds;
  const dealTypes = p ? p.dealTypeIds : r.dealTypeIds;
  const rawRegion = p ? p.regio : r.regio;
  const rawCities = p?.steden;
  const min = p ? p.prijsMin : r.budgetMin;
  const max = p ? p.prijsMax : r.budgetMax;
  let geverifieerd = 0;
  if (gevuld(types)) {
    if (o.propertyTypeId) {
      if (types.includes(o.propertyTypeId)) {matcht.push('Vastgoedtype komt overeen'); geverifieerd++}
      else afwijkend.push('Vastgoedtype wijkt af');
    } else controleer.push('Objecttype nog niet in nieuwe taxonomie bevestigd');
  } else if(gevuld(legacy)) {
    if(o.type) {
      if(legacy.includes(o.type)){matcht.push('Legacy vastgoedtype komt overeen'); geverifieerd++}
      else afwijkend.push('Legacy vastgoedtype wijkt af');
    } else controleer.push('Vastgoedtype object ontbreekt');
  } else controleer.push('Vastgoedtype van zoekende partij ontbreekt');
  if(gevuld(subtypes)){
    if(gevuld(o.propertySubtypeIds)) {
      if(overlap(subtypes,o.propertySubtypeIds))matcht.push('Subcategorie komt overeen');
      else controleer.push('Subcategorieën verschillen; controleren of dit uitsluit');
    }else controleer.push('Subcategorie object ontbreekt');
  }
  if(gevuld(dealTypes)){
    if(gevuld(o.dealTypeIds)) {
      if(overlap(dealTypes,o.dealTypeIds))matcht.push('Dealtype of strategie overlapt');
      else controleer.push('Dealtype/strategie komt niet overeen; huidige taxonomie mengt kenmerken');
    }else controleer.push('Dealtype object ontbreekt');
  }
  if(gevuld(rawRegion)||gevuld(rawCities))controleer.push('Regio of woonplaats eerst normaliseren en verifiëren');
  else controleer.push('Aankoopregio ontbreekt');
  if(min!=null||max!=null){
    if(typeof o.vraagprijs==='number'&&Number.isFinite(o.vraagprijs)) {
      if((min!=null&&o.vraagprijs<min)||(max!=null&&o.vraagprijs>max))afwijkend.push('Vraagprijs buiten opgegeven budgetgrenzen');
      else {matcht.push('Vraagprijs binnen budget'); geverifieerd++}
    }else controleer.push('Vraagprijs object ontbreekt');
  }else controleer.push('Aankoopbudget ontbreekt');
  const buyerConfirmed = getRoles(r)?.includes('koper') ?? false;
  const mandateConfirmed = p?.mandateConfirmed === true;
  const routeConfirmed = route.route === 'directe_koper' ? buyerConfirmed && (!p || mandateConfirmed) :
    has(getRoles(r),'bemiddelaar') && mandateConfirmed && route.mandaatType !== 'onbekend';
  if(!routeConfirmed)controleer.push('Aankoopintentie of bemiddelingsmandaat nog niet bevestigd');
  let koperRelatieId:string|null = null;
  if(route.route==='directe_koper' && routeConfirmed) koperRelatieId=r.id;
  else if(route.mandaatType==='namens_opdrachtgever' && p?.principalVerified && p.principalRelatieId &&
    p.principalRelatieId !== r.id && relaties.some(x => x.id===p.principalRelatieId && !x.softDeletedAt))
    koperRelatieId=p.principalRelatieId;
  else controleer.push('Uiteindelijke koper is onbekend of niet geverifieerd');
  const kwalificatie:MatchKwalificatie = afwijkend.length ? 'afwijkend' :
     geverifieerd===0 ? 'onvoldoende' :
     controleer.length>0||geverifieerd<2 ? 'te_verifieren' : 'passend';
  return {key:p?`zoekprofiel:${p.id}`:`relatie:${r.id}:basis`,zoekprofielId:p?.id??null,
    bron:p?'zoekprofiel':'relatie_basis',naam:p?.naam??'Algemene aankoopcriteria',route:route.route,
    kwalificatie,bevestiging:routeConfirmed?'bevestigd':'te_verifieren',
    koperRelatieId,redenVanRoute:route.reden,toelichting:{matcht,controleer,afwijkend}};
}

const rang:Record<MatchKwalificatie,number>={passend:4,te_verifieren:3,onvoldoende:2,afwijkend:1};

/**
 * Read-only adapter over existing CRM store records. Never writes to object_pipeline.
 * A rejected/archived object returns no new proactive candidates. Existing data stays unchanged.
 */
export function maakKandidaatVoorstellen(
 object:CrmObjectInput, relaties:readonly CrmRelatieInput[], zoekprofielen:readonly CrmMandaatInput[],
 options:{reedsGekoppeld?:ReadonlySet<string>; toonAfwijkende?:boolean}={}
):KandidaatVoorstel[]{
 if(!isAanbiedbaar(object))return [];
 const result:KandidaatVoorstel[]=[];
 for(const r of relaties){
   if(r.softDeletedAt||options.reedsGekoppeld?.has(r.id))continue;
   const profiles=zoekprofielen.filter(p=>p.relatieId===r.id&&p.status==='actief');
   const routes=[beoordelen(object,r,relaties),...profiles.map(p=>beoordelen(object,r,relaties,p))]
    .filter((x):x is ProfielRoute=>x!==null).filter(x=>options.toonAfwijkende||x.kwalificatie!=='afwijkend');
   if(!routes.length)continue;
   routes.sort((a,b)=>rang[b.kwalificatie]-rang[a.kwalificatie] || (a.bron==='zoekprofiel'?-1:1));
   result.push({relatieId:r.id,besteRoute:routes[0],alleRoutes:routes,
      aandachtNodig:routes[0].kwalificatie!=='passend'||routes[0].bevestiging!=='bevestigd',
      kanAutomatischVersturen:false,kanAutomatischBodMaken:false});
 }
 return result.sort((a,b)=>rang[b.besteRoute.kwalificatie]-rang[a.besteRoute.kwalificatie]);
}

/**
 * Explicit human handoff. Values are presentation-only; no action or SQL.
 * Existing object_pipeline only supports one row/object/relation; do not add a phantom buyer.
 */
export function maakKandidaatConcept(
  object:CrmObjectInput, voorstel:KandidaatVoorstel,gekozenRouteKey:string
) {
  const gekozen=voorstel.alleRoutes.find(x=>x.key===gekozenRouteKey);
  if(!gekozen) return {ok:false as const,reden:'Zoekmandaat niet gevonden'};
  if(!isAanbiedbaar(object))return {ok:false as const,reden:'Object is niet beschikbaar'};
  if(gekozen.kwalificatie==='afwijkend')return {ok:false as const,reden:'Harde criteria wijken af'};
  return {ok:true as const,concept:{objectId:object.id,contactRelatieId:voorstel.relatieId,
      gekozenMandaatId:gekozen.zoekprofielId,contactRoute:gekozen.route,
      koperRelatieId:gekozen.koperRelatieId,controles:gekozen.toelichting.controleer,
      // Deliberately no bid, contract, NDA, fee, or contact log side-effects.
      kanAutomatischVersturen:false as const,kanAutomatischBodMaken:false as const}};
}