// src/hooks/useDataStore.tsx
// Centrale datastore voor Bito Vastgoed CRM.
// - Laadt alle entiteiten bij login
// - Mapper's tussen Supabase snake_case en app camelCase
// - CRUD voor alle tabellen (inclusief fase-1 uitbreidingen)
// - Soft delete waar geconfigureerd

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  Relatie,
  RelatieContactpersoon,
  ObjectVastgoed,
  ObjectHuurder,
  ObjectDocument,
  ObjectFoto,
  ObjectHuurMetrics,
  Deal,
  Taak,
  Zoekprofiel,
  DealObjectKoppeling,
  DealKandidaat,
  KandidaatStatus,
  AssetClass,
  JaarDoel,
  ReferentieObject,
  DealReferentie,
  ObjectReferentie,
  PipelineKandidaat,
  Pipeline,
  PipelineStage,
} from '@/data/mock-data';
import { deleteBestanden } from '@/lib/storage';


// =====================================================================
// UTIL
// =====================================================================

const cleanPayload = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const out: any = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
};

const throwIfError = (error: any) => {
  if (error) {
    // Log volledige fout naar console voor debugging — UI krijgt generieke melding
    console.error('Database-bewerking mislukt:', error);
    throw new Error(error.message || 'De bewerking kon niet worden voltooid. Probeer het opnieuw.');
  }
};


// =====================================================================
// MAPPERS — RELATIES
// =====================================================================

const relatieFromDb = (r: any): Relatie => ({
  id: r.id,
  bedrijfsnaam: r.bedrijfsnaam ?? '',
  contactpersoon: r.contactpersoon ?? '',
  type: r.type_partij ?? 'belegger',
  investeerderSubtype: r.investeerder_subtype ?? undefined,
  telefoon: r.telefoon ?? '',
  email: r.email ?? '',
  website: r.website ?? undefined,
  linkedinUrl: r.linkedin_url ?? undefined,
  kvkNummer: r.kvk_nummer ?? undefined,
  vestigingsadres: r.vestigingsadres ?? undefined,
  vestigingspostcode: r.vestigingspostcode ?? undefined,
  vestigingsplaats: r.vestigingsplaats ?? undefined,
  vestigingsland: r.vestigingsland ?? 'NL',
  regio: r.regio ?? [],
  assetClasses: r.asset_classes ?? [],
  propertyTypeIds: r.property_type_ids ?? [],
  propertySubtypeIds: r.property_subtype_ids ?? [],
  dealTypeIds: r.deal_type_ids ?? [],
  budgetMin: r.budget_min ?? undefined,
  budgetMax: r.budget_max ?? undefined,
  rendementseis: r.rendementseis != null ? Number(r.rendementseis) : undefined,
  kapitaalsituatie: r.kapitaalsituatie ?? 'onbekend',
  eigenVermogenPct: r.eigen_vermogen_pct != null ? Number(r.eigen_vermogen_pct) : undefined,
  voorkeurDealstructuur: r.voorkeur_dealstructuur ?? [],
  voorkeurKanaal: r.voorkeur_kanaal ?? undefined,
  voorkeurTaal: r.voorkeur_taal ?? 'nl',
  aankoopcriteria: r.aankoopcriteria ?? undefined,
  verkoopintentie: r.verkoopintentie ?? undefined,
  ndaGetekend: !!r.nda_getekend,
  ndaDatum: r.nda_datum ?? undefined,
  bronRelatie: r.bron_relatie ?? undefined,
  leadStatus: r.lead_status ?? 'lauw',
  laatsteContact: r.laatste_contactdatum ?? '',
  volgendeActie: r.volgende_actie ?? undefined,
  notities: r.notities ?? undefined,
  softDeletedAt: r.soft_deleted_at ?? undefined,
});

const relatieToDb = (r: Partial<Relatie>) => cleanPayload({
  bedrijfsnaam: r.bedrijfsnaam !== undefined ? (r.bedrijfsnaam || 'Onbekend') : undefined,
  contactpersoon: r.contactpersoon !== undefined ? (r.contactpersoon || null) : undefined,
  type_partij: r.type,
  investeerder_subtype: r.investeerderSubtype !== undefined ? (r.investeerderSubtype || null) : undefined,
  telefoon: r.telefoon !== undefined ? (r.telefoon || null) : undefined,
  email: r.email !== undefined ? (r.email || null) : undefined,
  website: r.website !== undefined ? (r.website || null) : undefined,
  linkedin_url: r.linkedinUrl !== undefined ? (r.linkedinUrl || null) : undefined,
  kvk_nummer: r.kvkNummer !== undefined ? (r.kvkNummer || null) : undefined,
  vestigingsadres: r.vestigingsadres !== undefined ? (r.vestigingsadres || null) : undefined,
  vestigingspostcode: r.vestigingspostcode !== undefined ? (r.vestigingspostcode || null) : undefined,
  vestigingsplaats: r.vestigingsplaats !== undefined ? (r.vestigingsplaats || null) : undefined,
  vestigingsland: r.vestigingsland !== undefined ? (r.vestigingsland || 'NL') : undefined,
  regio: r.regio,
  asset_classes: r.assetClasses,
  property_type_ids: r.propertyTypeIds !== undefined ? (r.propertyTypeIds ?? []) : undefined,
  property_subtype_ids: r.propertySubtypeIds !== undefined ? (r.propertySubtypeIds ?? []) : undefined,
  deal_type_ids: r.dealTypeIds !== undefined ? (r.dealTypeIds ?? []) : undefined,
  budget_min: r.budgetMin ?? null,
  budget_max: r.budgetMax ?? null,
  rendementseis: r.rendementseis ?? null,
  kapitaalsituatie: r.kapitaalsituatie,
  eigen_vermogen_pct: r.eigenVermogenPct ?? null,
  voorkeur_dealstructuur: r.voorkeurDealstructuur,
  voorkeur_kanaal: r.voorkeurKanaal !== undefined ? (r.voorkeurKanaal || null) : undefined,
  voorkeur_taal: r.voorkeurTaal !== undefined ? (r.voorkeurTaal || 'nl') : undefined,
  aankoopcriteria: r.aankoopcriteria !== undefined ? (r.aankoopcriteria || null) : undefined,
  verkoopintentie: r.verkoopintentie !== undefined ? (r.verkoopintentie || null) : undefined,
  nda_getekend: r.ndaGetekend,
  nda_datum: r.ndaDatum !== undefined ? (r.ndaDatum || null) : undefined,
  bron_relatie: r.bronRelatie !== undefined ? (r.bronRelatie || null) : undefined,
  lead_status: r.leadStatus,
  laatste_contactdatum: r.laatsteContact !== undefined ? (r.laatsteContact || null) : undefined,
  volgende_actie: r.volgendeActie !== undefined ? (r.volgendeActie || null) : undefined,
  notities: r.notities !== undefined ? (r.notities || null) : undefined,
});


// =====================================================================
// MAPPERS — CONTACTPERSONEN
// =====================================================================

const contactpersoonFromDb = (c: any): RelatieContactpersoon => ({
  id: c.id,
  relatieId: c.relatie_id,
  naam: c.naam ?? '',
  functie: c.functie ?? undefined,
  email: c.email ?? undefined,
  telefoon: c.telefoon ?? undefined,
  linkedinUrl: c.linkedin_url ?? undefined,
  isPrimair: !!c.is_primair,
  decisionMaker: !!c.decision_maker,
  voorkeurKanaal: c.voorkeur_kanaal ?? undefined,
  voorkeurTaal: c.voorkeur_taal ?? 'nl',
  notities: c.notities ?? undefined,
});

const contactpersoonToDb = (c: Partial<RelatieContactpersoon>) => cleanPayload({
  relatie_id: c.relatieId,
  naam: c.naam !== undefined ? (c.naam || 'Onbekend') : undefined,
  functie: c.functie !== undefined ? (c.functie || null) : undefined,
  email: c.email !== undefined ? (c.email || null) : undefined,
  telefoon: c.telefoon !== undefined ? (c.telefoon || null) : undefined,
  linkedin_url: c.linkedinUrl !== undefined ? (c.linkedinUrl || null) : undefined,
  is_primair: c.isPrimair,
  decision_maker: c.decisionMaker,
  voorkeur_kanaal: c.voorkeurKanaal !== undefined ? (c.voorkeurKanaal || null) : undefined,
  voorkeur_taal: c.voorkeurTaal !== undefined ? (c.voorkeurTaal || 'nl') : undefined,
  notities: c.notities !== undefined ? (c.notities || null) : undefined,
});


// =====================================================================
// MAPPERS — OBJECTEN
// =====================================================================

function mapDbObjectStatusNaarApp(s: string): any {
  switch (s) {
    case 'nieuw': return 'off-market';
    case 'in_voorbereiding': return 'in_onderzoek';
    case 'beschikbaar': return 'beschikbaar';
    case 'in_onderhandeling': return 'onder_optie';
    case 'verkocht': return 'verkocht';
    case 'ingetrokken': return 'ingetrokken';
    default: return 'off-market';
  }
}
function mapAppObjectStatusNaarDb(s: any): string {
  switch (s) {
    case 'off-market': return 'nieuw';
    case 'in_onderzoek': return 'in_voorbereiding';
    case 'beschikbaar': return 'beschikbaar';
    case 'onder_optie': return 'in_onderhandeling';
    case 'verkocht': return 'verkocht';
    case 'ingetrokken': return 'ingetrokken';
    default: return 'nieuw';
  }
}

const objectFromDb = (o: any): ObjectVastgoed => ({
  id: o.id,
  titel: o.objectnaam ?? '',
  internReferentienummer: o.intern_referentienummer ?? undefined,
  anoniem: !!o.anoniem,
  publiekeNaam: o.publieke_naam ?? undefined,
  publiekeRegio: o.publieke_regio ?? undefined,
  adres: o.adres ?? undefined,
  postcode: o.postcode ?? undefined,
  plaats: o.plaats ?? '',
  provincie: o.provincie ?? '',
  type: o.type_vastgoed,
  subcategorie: o.subcategorie ?? undefined,
  subcategorieId: o.subcategorie_id ?? undefined,
  propertyTypeId: o.property_type_id ?? undefined,
  propertySubtypeIds: o.property_subtype_ids ?? [],
  dealTypeIds: o.deal_type_ids ?? [],
  status: mapDbObjectStatusNaarApp(o.status),
  beschikbaarVanaf: o.beschikbaar_vanaf ?? undefined,
  bron: o.bron ?? undefined,
  exclusief: !!o.exclusief,
  vraagprijs: o.vraagprijs ?? undefined,
  prijsindicatie: o.prijsindicatie ?? undefined,
  huurinkomsten: o.huurinkomsten ?? undefined,
  huurPerM2: o.huur_per_m2 != null ? Number(o.huur_per_m2) : undefined,
  brutoAanvangsrendement: o.bruto_aanvangsrendement != null ? Number(o.bruto_aanvangsrendement) : undefined,
  nettoAanvangsrendement: o.netto_aanvangsrendement != null ? Number(o.netto_aanvangsrendement) : undefined,
  noi: o.noi ?? undefined,
  servicekostenJaar: o.servicekosten_jaar ?? undefined,
  wozWaarde: o.woz_waarde ?? undefined,
  wozPeildatum: o.woz_peildatum ?? undefined,
  taxatiewaarde: o.taxatiewaarde ?? undefined,
  taxatiedatum: o.taxatiedatum ?? undefined,
  verhuurStatus: o.verhuurstatus ?? 'leeg',
  aantalHuurders: o.aantal_huurders ?? undefined,
  leegstandPct: o.leegstand_pct != null ? Number(o.leegstand_pct) : undefined,
  oppervlakte: o.oppervlakte ?? undefined,
  oppervlakteVvo: o.oppervlakte_vvo ?? undefined,
  oppervlakteBvo: o.oppervlakte_bvo ?? undefined,
  oppervlakteGbo: o.oppervlakte_gbo ?? undefined,
  perceelOppervlakte: o.perceel_oppervlakte ?? undefined,
  bouwjaar: o.bouwjaar ?? undefined,
  energielabel: o.energielabel ?? undefined,
  energielabelV2: o.energielabel_v2 ?? undefined,
  huidigGebruik: o.huidig_gebruik ?? undefined,
  aantalVerdiepingen: o.aantal_verdiepingen ?? undefined,
  aantalUnits: o.aantal_units ?? undefined,
  onderhoudsstaat: o.onderhoudsstaat ?? undefined,
  onderhoudsstaatNiveau: o.onderhoudsstaat_niveau ?? undefined,
  recenteInvesteringen: o.recente_investeringen ?? undefined,
  achterstalligOnderhoud: o.achterstallig_onderhoud ?? undefined,
  asbestinventarisatieAanwezig: !!o.asbestinventarisatie_aanwezig,
  eigendomssituatie: o.eigendomssituatie ?? undefined,
  erfpachtinformatie: o.erfpachtinformatie ?? undefined,
  bestemmingsinformatie: o.bestemmingsinformatie ?? undefined,
  kadastraleGemeente: o.kadastrale_gemeente ?? undefined,
  kadastraleSectie: o.kadastrale_sectie ?? undefined,
  kadastraalNummer: o.kadastraal_nummer ?? undefined,
  ontwikkelPotentie: !!o.ontwikkelpotentie,
  transformatiePotentie: !!o.transformatiepotentie,
  samenvatting: o.samenvatting ?? undefined,
  investeringsthese: o.investeringsthese ?? undefined,
  risicos: o.risicos ?? undefined,
  onderscheidendeKenmerken: o.onderscheidende_kenmerken ?? undefined,
  verkoperNaam: o.verkoper_naam ?? undefined,
  verkoperRol: o.verkoper_rol ?? undefined,
  verkoperVia: o.verkoper_via ?? 'onbekend',
  verkoperTelefoon: o.verkoper_telefoon ?? undefined,
  verkoperEmail: o.verkoper_email ?? undefined,
  verkoopmotivatie: o.verkoopmotivatie ?? undefined,
  isPortefeuille: !!o.is_portefeuille,
  parentObjectId: o.parent_object_id ?? undefined,
  documentenBeschikbaar: !!o.documentatie_beschikbaar,
  interneOpmerkingen: o.interne_opmerkingen ?? undefined,
  opmerkingen: o.opmerkingen ?? undefined,
  datumToegevoegd: o.created_at?.split('T')[0] ?? '',
  updatedAt: o.updated_at ?? undefined,
  softDeletedAt: o.soft_deleted_at ?? undefined,
  referentieanalyseZichtbaar: o.referentieanalyse_zichtbaar !== false,
  pipelineId: o.pipeline_id ?? undefined,
  pipelineStageId: o.pipeline_stage_id ?? undefined,
  pipelineUpdatedAt: o.pipeline_updated_at ?? undefined,
  pipelineStageLocked: !!o.pipeline_stage_locked,
});

const objectToDb = (o: Partial<ObjectVastgoed>) => cleanPayload({
  objectnaam: o.titel !== undefined ? (o.titel || 'Onbekend object') : undefined,
  intern_referentienummer: o.internReferentienummer !== undefined ? (o.internReferentienummer || null) : undefined,
  anoniem: o.anoniem,
  publieke_naam: o.publiekeNaam !== undefined ? (o.publiekeNaam || null) : undefined,
  publieke_regio: o.publiekeRegio !== undefined ? (o.publiekeRegio || null) : undefined,
  adres: o.adres !== undefined ? (o.adres || null) : undefined,
  postcode: o.postcode !== undefined ? (o.postcode || null) : undefined,
  plaats: o.plaats !== undefined ? (o.plaats || null) : undefined,
  provincie: o.provincie !== undefined ? (o.provincie || null) : undefined,
  type_vastgoed: o.type,
  subcategorie: o.subcategorie !== undefined ? (o.subcategorie || null) : undefined,
  subcategorie_id: o.subcategorieId !== undefined ? (o.subcategorieId || null) : undefined,
  property_type_id: o.propertyTypeId !== undefined ? (o.propertyTypeId || null) : undefined,
  property_subtype_ids: o.propertySubtypeIds !== undefined ? (o.propertySubtypeIds ?? []) : undefined,
  deal_type_ids: o.dealTypeIds !== undefined ? (o.dealTypeIds ?? []) : undefined,
  status: o.status !== undefined ? mapAppObjectStatusNaarDb(o.status) : undefined,
  beschikbaar_vanaf: o.beschikbaarVanaf !== undefined ? (o.beschikbaarVanaf || null) : undefined,
  bron: o.bron !== undefined ? (o.bron || null) : undefined,
  exclusief: o.exclusief,
  vraagprijs: o.vraagprijs ?? null,
  prijsindicatie: o.prijsindicatie !== undefined ? (o.prijsindicatie || null) : undefined,
  huurinkomsten: o.huurinkomsten ?? null,
  huur_per_m2: o.huurPerM2 ?? null,
  bruto_aanvangsrendement: o.brutoAanvangsrendement ?? null,
  netto_aanvangsrendement: o.nettoAanvangsrendement ?? null,
  noi: o.noi ?? null,
  servicekosten_jaar: o.servicekostenJaar ?? null,
  woz_waarde: o.wozWaarde ?? null,
  woz_peildatum: o.wozPeildatum !== undefined ? (o.wozPeildatum || null) : undefined,
  taxatiewaarde: o.taxatiewaarde ?? null,
  taxatiedatum: o.taxatiedatum !== undefined ? (o.taxatiedatum || null) : undefined,
  verhuurstatus: o.verhuurStatus,
  aantal_huurders: o.aantalHuurders ?? null,
  leegstand_pct: o.leegstandPct ?? null,
  oppervlakte: o.oppervlakte ?? null,
  oppervlakte_vvo: o.oppervlakteVvo ?? null,
  oppervlakte_bvo: o.oppervlakteBvo ?? null,
  oppervlakte_gbo: o.oppervlakteGbo ?? null,
  perceel_oppervlakte: o.perceelOppervlakte ?? null,
  bouwjaar: o.bouwjaar ?? null,
  energielabel: o.energielabel !== undefined ? (o.energielabel || null) : undefined,
  energielabel_v2: o.energielabelV2 !== undefined ? (o.energielabelV2 || null) : undefined,
  huidig_gebruik: o.huidigGebruik !== undefined ? (o.huidigGebruik || null) : undefined,
  aantal_verdiepingen: o.aantalVerdiepingen ?? null,
  aantal_units: o.aantalUnits ?? null,
  onderhoudsstaat: o.onderhoudsstaat !== undefined ? (o.onderhoudsstaat || null) : undefined,
  onderhoudsstaat_niveau: o.onderhoudsstaatNiveau !== undefined ? (o.onderhoudsstaatNiveau || null) : undefined,
  recente_investeringen: o.recenteInvesteringen !== undefined ? (o.recenteInvesteringen || null) : undefined,
  achterstallig_onderhoud: o.achterstalligOnderhoud !== undefined ? (o.achterstalligOnderhoud || null) : undefined,
  asbestinventarisatie_aanwezig: o.asbestinventarisatieAanwezig,
  eigendomssituatie: o.eigendomssituatie !== undefined ? (o.eigendomssituatie || null) : undefined,
  erfpachtinformatie: o.erfpachtinformatie !== undefined ? (o.erfpachtinformatie || null) : undefined,
  bestemmingsinformatie: o.bestemmingsinformatie !== undefined ? (o.bestemmingsinformatie || null) : undefined,
  kadastrale_gemeente: o.kadastraleGemeente !== undefined ? (o.kadastraleGemeente || null) : undefined,
  kadastrale_sectie: o.kadastraleSectie !== undefined ? (o.kadastraleSectie || null) : undefined,
  kadastraal_nummer: o.kadastraalNummer !== undefined ? (o.kadastraalNummer || null) : undefined,
  ontwikkelpotentie: o.ontwikkelPotentie,
  transformatiepotentie: o.transformatiePotentie,
  samenvatting: o.samenvatting !== undefined ? (o.samenvatting || null) : undefined,
  investeringsthese: o.investeringsthese !== undefined ? (o.investeringsthese || null) : undefined,
  risicos: o.risicos !== undefined ? (o.risicos || null) : undefined,
  onderscheidende_kenmerken: o.onderscheidendeKenmerken !== undefined ? (o.onderscheidendeKenmerken || null) : undefined,
  verkoper_naam: o.verkoperNaam !== undefined ? (o.verkoperNaam || null) : undefined,
  verkoper_rol: o.verkoperRol !== undefined ? (o.verkoperRol || null) : undefined,
  verkoper_via: o.verkoperVia,
  verkoper_telefoon: o.verkoperTelefoon !== undefined ? (o.verkoperTelefoon || null) : undefined,
  verkoper_email: o.verkoperEmail !== undefined ? (o.verkoperEmail || null) : undefined,
  verkoopmotivatie: o.verkoopmotivatie !== undefined ? (o.verkoopmotivatie || null) : undefined,
  is_portefeuille: o.isPortefeuille,
  parent_object_id: o.parentObjectId !== undefined ? (o.parentObjectId || null) : undefined,
  documentatie_beschikbaar: o.documentenBeschikbaar,
  interne_opmerkingen: o.interneOpmerkingen !== undefined ? (o.interneOpmerkingen || null) : undefined,
  opmerkingen: o.opmerkingen !== undefined ? (o.opmerkingen || null) : undefined,
  referentieanalyse_zichtbaar: o.referentieanalyseZichtbaar,
  pipeline_id: o.pipelineId !== undefined ? (o.pipelineId || null) : undefined,
  pipeline_stage_id: o.pipelineStageId !== undefined ? (o.pipelineStageId || null) : undefined,
  pipeline_updated_at: o.pipelineUpdatedAt !== undefined ? (o.pipelineUpdatedAt || null) : undefined,
  pipeline_stage_locked: o.pipelineStageLocked,
});


// =====================================================================
// MAPPERS — OVERIG
// =====================================================================

const huurderFromDb = (h: any): ObjectHuurder => ({
  id: h.id,
  objectId: h.object_id,
  huurderNaam: h.huurder_naam ?? '',
  branche: h.branche ?? undefined,
  oppervlakteM2: h.oppervlakte_m2 ?? undefined,
  jaarhuur: h.jaarhuur ?? undefined,
  servicekostenJaar: h.servicekosten_jaar ?? undefined,
  ingangsdatum: h.ingangsdatum ?? undefined,
  einddatum: h.einddatum ?? undefined,
  opzegmogelijkheid: h.opzegmogelijkheid ?? undefined,
  indexatieBasis: h.indexatie_basis ?? undefined,
  indexatiePct: h.indexatie_pct != null ? Number(h.indexatie_pct) : undefined,
  notities: h.notities ?? undefined,
});

const huurderToDb = (h: Partial<ObjectHuurder>) => cleanPayload({
  object_id: h.objectId,
  huurder_naam: h.huurderNaam !== undefined ? (h.huurderNaam || 'Onbekend') : undefined,
  branche: h.branche !== undefined ? (h.branche || null) : undefined,
  oppervlakte_m2: h.oppervlakteM2 ?? null,
  jaarhuur: h.jaarhuur ?? null,
  servicekosten_jaar: h.servicekostenJaar ?? null,
  ingangsdatum: h.ingangsdatum !== undefined ? (h.ingangsdatum || null) : undefined,
  einddatum: h.einddatum !== undefined ? (h.einddatum || null) : undefined,
  opzegmogelijkheid: h.opzegmogelijkheid !== undefined ? (h.opzegmogelijkheid || null) : undefined,
  indexatie_basis: h.indexatieBasis,
  indexatie_pct: h.indexatiePct ?? null,
  notities: h.notities !== undefined ? (h.notities || null) : undefined,
});

const documentFromDb = (d: any): ObjectDocument => ({
  id: d.id,
  objectId: d.object_id,
  documenttype: d.documenttype ?? 'anders',
  bestandsnaam: d.bestandsnaam ?? '',
  storagePath: d.storage_path ?? '',
  bestandsgrootteBytes: d.bestandsgrootte_bytes ?? undefined,
  mimeType: d.mime_type ?? undefined,
  vertrouwelijk: !!d.vertrouwelijk,
  notities: d.notities ?? undefined,
  geuploadDoor: d.geupload_door ?? undefined,
  createdAt: d.created_at ?? '',
});

const fotoFromDb = (f: any): ObjectFoto => ({
  id: f.id,
  objectId: f.object_id,
  storagePath: f.storage_path ?? '',
  bijschrift: f.bijschrift ?? undefined,
  isHoofdfoto: !!f.is_hoofdfoto,
  volgorde: f.volgorde ?? 0,
  bestandsgrootteBytes: f.bestandsgrootte_bytes ?? undefined,
});

const huurMetricsFromDb = (m: any): ObjectHuurMetrics => ({
  objectId: m.object_id,
  aantalHuurders: m.aantal_huurders ?? 0,
  totaleJaarhuur: m.totale_jaarhuur ?? 0,
  verhuurdeM2: m.verhuurde_m2 ?? 0,
  waltJaren: m.walt_jaren != null ? Number(m.walt_jaren) : undefined,
  walbJaren: m.walb_jaren != null ? Number(m.walb_jaren) : undefined,
});


// =====================================================================
// MAPPERS — DEALS / TAKEN / ZOEKPROFIELEN / KOPPELINGEN
// =====================================================================

const dealFromDb = (d: any): Deal => ({
  id: d.id,
  objectId: d.object_id,
  relatieId: d.relatie_id,
  fase: d.fase,
  interessegraad: d.interessegraad ?? 3,
  datumEersteContact: d.datum_eerste_contact,
  datumFollowUp: d.datum_follow_up ?? undefined,
  followUpTijd: d.follow_up_tijd ?? undefined,
  bezichtigingGepland: d.bezichtiging_gepland ?? undefined,
  bezichtigingTijd: d.bezichtiging_tijd ?? undefined,
  indicatiefBod: d.indicatief_bod ?? undefined,
  verwachteClosingdatum: d.verwachte_closingdatum ?? undefined,
  commissiePct: d.commissie_pct != null ? Number(d.commissie_pct) : undefined,
  commissieBedrag: d.commissie_bedrag ?? undefined,
  feeStructuur: d.fee_structuur ?? undefined,
  ddStatus: d.dd_status ?? 'niet_gestart',
  notaris: d.notaris ?? undefined,
  bank: d.bank ?? undefined,
  tegenpartijMakelaar: d.tegenpartij_makelaar ?? undefined,
  afwijzingsreden: d.afwijzingsreden ?? undefined,
  notities: d.notities ?? undefined,
  // Toggle voor referentieanalyse-sectie. Default true (aan).
  referentieanalyseZichtbaar: d.referentieanalyse_zichtbaar !== false,
  softDeletedAt: d.soft_deleted_at ?? undefined,
});

const dealToDb = (d: Partial<Deal>) => cleanPayload({
  object_id: d.objectId,
  relatie_id: d.relatieId,
  fase: d.fase,
  interessegraad: d.interessegraad ?? null,
  datum_eerste_contact: d.datumEersteContact,
  datum_follow_up: d.datumFollowUp !== undefined ? (d.datumFollowUp || null) : undefined,
  follow_up_tijd: d.followUpTijd !== undefined ? (d.followUpTijd || null) : undefined,
  bezichtiging_gepland: d.bezichtigingGepland !== undefined ? (d.bezichtigingGepland || null) : undefined,
  bezichtiging_tijd: d.bezichtigingTijd !== undefined ? (d.bezichtigingTijd || null) : undefined,
  indicatief_bod: d.indicatiefBod ?? null,
  verwachte_closingdatum: d.verwachteClosingdatum !== undefined ? (d.verwachteClosingdatum || null) : undefined,
  commissie_pct: d.commissiePct ?? null,
  commissie_bedrag: d.commissieBedrag ?? null,
  fee_structuur: d.feeStructuur !== undefined ? (d.feeStructuur || null) : undefined,
  dd_status: d.ddStatus,
  notaris: d.notaris !== undefined ? (d.notaris || null) : undefined,
  bank: d.bank !== undefined ? (d.bank || null) : undefined,
  tegenpartij_makelaar: d.tegenpartijMakelaar !== undefined ? (d.tegenpartijMakelaar || null) : undefined,
  afwijzingsreden: d.afwijzingsreden !== undefined ? (d.afwijzingsreden || null) : undefined,
  notities: d.notities !== undefined ? (d.notities || null) : undefined,
  referentieanalyse_zichtbaar: d.referentieanalyseZichtbaar,
});

const taakFromDb = (t: any): Taak => ({
  id: t.id,
  titel: t.titel ?? '',
  relatieId: t.relatie_id ?? undefined,
  dealId: t.deal_id ?? undefined,
  type: t.type_taak ?? 'Overig',
  deadline: t.deadline ?? '',
  deadlineTijd: t.deadline_tijd ?? undefined,
  prioriteit: t.prioriteit ?? 'normaal',
  status: t.status ?? 'open',
  notities: t.notities ?? undefined,
  softDeletedAt: t.soft_deleted_at ?? undefined,
});

const taakToDb = (t: Partial<Taak>) => cleanPayload({
  titel: t.titel !== undefined ? (t.titel || 'Naamloze taak') : undefined,
  relatie_id: t.relatieId !== undefined ? (t.relatieId || null) : undefined,
  deal_id: t.dealId !== undefined ? (t.dealId || null) : undefined,
  type_taak: t.type !== undefined ? (t.type || null) : undefined,
  deadline: t.deadline !== undefined ? (t.deadline || null) : undefined,
  deadline_tijd: t.deadlineTijd !== undefined ? (t.deadlineTijd || null) : undefined,
  prioriteit: t.prioriteit,
  status: t.status,
  notities: t.notities !== undefined ? (t.notities || null) : undefined,
});

const zoekprofielFromDb = (z: any): Zoekprofiel => ({
  id: z.id,
  naam: z.profielnaam ?? '',
  relatieId: z.relatie_id,
  typeVastgoed: z.type_vastgoed ?? [],
  subcategorieIds: z.subcategorie_ids ?? [],
  propertyTypeIds: z.property_type_ids ?? [],
  propertySubtypeIds: z.property_subtype_ids_v2 ?? [],
  dealTypeIds: z.deal_type_ids ?? [],
  regio: z.regio ?? [],
  stad: z.steden?.[0] ?? undefined,
  steden: z.steden ?? [],
  prijsMin: z.prijs_min ?? undefined,
  prijsMax: z.prijs_max ?? undefined,
  oppervlakteMin: z.oppervlakte_min ?? undefined,
  oppervlakteMax: z.oppervlakte_max ?? undefined,
  bouwjaarMin: z.bouwjaar_min ?? undefined,
  bouwjaarMax: z.bouwjaar_max ?? undefined,
  energielabelMin: z.energielabel_min ?? undefined,
  verhuurStatus: z.verhuur_voorkeur ?? undefined,
  rendementseis: z.rendementseis != null ? Number(z.rendementseis) : undefined,
  waltMin: z.walt_min != null ? Number(z.walt_min) : undefined,
  leegstandMaxPct: z.leegstand_max_pct != null ? Number(z.leegstand_max_pct) : undefined,
  ontwikkelPotentie: !!z.ontwikkelpotentie,
  transformatiePotentie: !!z.transformatiepotentie,
  transactietypeVoorkeur: z.transactietype_voorkeur ?? [],
  exclusiviteitVoorkeur: z.exclusiviteit_voorkeur ?? 'beide',
  prioriteit: z.prioriteit ?? 3,
  aanvullendeCriteria: z.aanvullende_criteria ?? undefined,
  status: z.status === 'gepauzeerd' ? 'pauze' : z.status,
  updatedAt: z.updated_at ?? undefined,
});

const zoekprofielToDb = (z: Partial<Zoekprofiel>) => cleanPayload({
  profielnaam: z.naam !== undefined ? (z.naam || 'Naamloos zoekprofiel') : undefined,
  relatie_id: z.relatieId,
  type_vastgoed: z.typeVastgoed,
  subcategorie_ids: z.subcategorieIds,
  property_type_ids: z.propertyTypeIds !== undefined ? (z.propertyTypeIds ?? []) : undefined,
  property_subtype_ids_v2: z.propertySubtypeIds !== undefined ? (z.propertySubtypeIds ?? []) : undefined,
  deal_type_ids: z.dealTypeIds !== undefined ? (z.dealTypeIds ?? []) : undefined,
  regio: z.regio,
  steden: z.steden !== undefined ? z.steden : (z.stad !== undefined ? (z.stad ? [z.stad] : []) : undefined),
  prijs_min: z.prijsMin ?? null,
  prijs_max: z.prijsMax ?? null,
  oppervlakte_min: z.oppervlakteMin ?? null,
  oppervlakte_max: z.oppervlakteMax ?? null,
  bouwjaar_min: z.bouwjaarMin ?? null,
  bouwjaar_max: z.bouwjaarMax ?? null,
  energielabel_min: z.energielabelMin !== undefined ? (z.energielabelMin || null) : undefined,
  verhuur_voorkeur: z.verhuurStatus ?? null,
  rendementseis: z.rendementseis ?? null,
  walt_min: z.waltMin ?? null,
  leegstand_max_pct: z.leegstandMaxPct ?? null,
  ontwikkelpotentie: z.ontwikkelPotentie,
  transformatiepotentie: z.transformatiePotentie,
  transactietype_voorkeur: z.transactietypeVoorkeur,
  exclusiviteit_voorkeur: z.exclusiviteitVoorkeur,
  prioriteit: z.prioriteit,
  aanvullende_criteria: z.aanvullendeCriteria !== undefined ? (z.aanvullendeCriteria || null) : undefined,
  status: z.status !== undefined ? (z.status === 'pauze' ? 'gepauzeerd' : z.status) : undefined,
});

const dealObjectFromDb = (r: any): DealObjectKoppeling => ({
  id: r.id,
  dealId: r.deal_id,
  objectId: r.object_id,
  isPrimair: !!r.is_primair,
  notities: r.notities ?? undefined,
});

const dealKandidaatFromDb = (r: any): DealKandidaat => ({
  id: r.id,
  dealId: r.deal_id,
  relatieId: r.relatie_id,
  status: r.status,
  notities: r.notities ?? undefined,
});

// MAPPERS — PIPELINE
const pipelineFromDb = (r: any): PipelineKandidaat => ({
  id: r.id,
  objectId: r.object_id,
  relatieId: r.relatie_id,
  zoekprofielId: r.zoekprofiel_id ?? undefined,
  pipelineFase: r.pipeline_fase,
  interesseNiveau: r.interesse_niveau,
  matchscore: r.matchscore ?? undefined,
  teaserVerstuurd: !!r.teaser_verstuurd,
  teaserVerstuurdOp: r.teaser_verstuurd_op ?? undefined,
  ndaVerstuurd: !!r.nda_verstuurd,
  ndaVerstuurdOp: r.nda_verstuurd_op ?? undefined,
  ndaGetekend: !!r.nda_getekend,
  ndaGetekendOp: r.nda_getekend_op ?? undefined,
  informatieGedeeld: !!r.informatie_gedeeld,
  informatieGedeeldOp: r.informatie_gedeeld_op ?? undefined,
  bezichtigingDatum: r.bezichtiging_datum ?? undefined,
  biedingBedrag: r.bieding_bedrag != null ? Number(r.bieding_bedrag) : undefined,
  biedingVoorwaarden: r.bieding_voorwaarden ?? undefined,
  financieringsvoorbehoud: r.financieringsvoorbehoud ?? undefined,
  gewensteLevering: r.gewenste_levering ?? undefined,
  feeAkkoord: !!r.fee_akkoord,
  laatsteContactdatum: r.laatste_contactdatum ?? undefined,
  volgendeActie: r.volgende_actie ?? undefined,
  volgendeActieOmschrijving: r.volgende_actie_omschrijving ?? undefined,
  volgendeActieDatum: r.volgende_actie_datum ?? undefined,
  notities: r.notities ?? undefined,
  redenAfgevallen: r.reden_afgevallen ?? undefined,
  createdAt: r.created_at ?? undefined,
  updatedAt: r.updated_at ?? undefined,
});

const pipelineToDb = (p: Partial<PipelineKandidaat>) => cleanPayload({
  object_id: p.objectId,
  relatie_id: p.relatieId,
  zoekprofiel_id: p.zoekprofielId !== undefined ? (p.zoekprofielId || null) : undefined,
  pipeline_fase: p.pipelineFase,
  interesse_niveau: p.interesseNiveau,
  matchscore: p.matchscore ?? null,
  teaser_verstuurd: p.teaserVerstuurd,
  teaser_verstuurd_op: p.teaserVerstuurdOp !== undefined ? (p.teaserVerstuurdOp || null) : undefined,
  nda_verstuurd: p.ndaVerstuurd,
  nda_verstuurd_op: p.ndaVerstuurdOp !== undefined ? (p.ndaVerstuurdOp || null) : undefined,
  nda_getekend: p.ndaGetekend,
  nda_getekend_op: p.ndaGetekendOp !== undefined ? (p.ndaGetekendOp || null) : undefined,
  informatie_gedeeld: p.informatieGedeeld,
  informatie_gedeeld_op: p.informatieGedeeldOp !== undefined ? (p.informatieGedeeldOp || null) : undefined,
  bezichtiging_datum: p.bezichtigingDatum !== undefined ? (p.bezichtigingDatum || null) : undefined,
  bieding_bedrag: p.biedingBedrag !== undefined ? (p.biedingBedrag ?? null) : undefined,
  bieding_voorwaarden: p.biedingVoorwaarden !== undefined ? (p.biedingVoorwaarden || null) : undefined,
  financieringsvoorbehoud: p.financieringsvoorbehoud ?? null,
  gewenste_levering: p.gewensteLevering !== undefined ? (p.gewensteLevering || null) : undefined,
  fee_akkoord: p.feeAkkoord,
  laatste_contactdatum: p.laatsteContactdatum !== undefined ? (p.laatsteContactdatum || null) : undefined,
  volgende_actie: p.volgendeActie !== undefined ? (p.volgendeActie || null) : undefined,
  volgende_actie_omschrijving: p.volgendeActieOmschrijving !== undefined ? (p.volgendeActieOmschrijving || null) : undefined,
  volgende_actie_datum: p.volgendeActieDatum !== undefined ? (p.volgendeActieDatum || null) : undefined,
  notities: p.notities !== undefined ? (p.notities || null) : undefined,
  reden_afgevallen: p.redenAfgevallen !== undefined ? (p.redenAfgevallen || null) : undefined,
});

// MAPPERS — PIPELINE-DEFINITIES (object pipeline)
const pipelineDefFromDb = (r: any): Pipeline => ({
  id: r.id,
  name: r.name ?? '',
  entityType: r.entity_type ?? 'object',
  isActive: r.is_active !== false,
  isDefault: !!r.is_default,
});

const pipelineStageFromDb = (r: any): PipelineStage => ({
  id: r.id,
  pipelineId: r.pipeline_id,
  name: r.name ?? '',
  slug: r.slug ?? '',
  sortOrder: r.sort_order ?? 0,
  color: r.color ?? undefined,
  probability: r.probability ?? undefined,
  isWon: !!r.is_won,
  isLost: !!r.is_lost,
  isActive: r.is_active !== false,
});

const jaarDoelFromDb = (j: any): JaarDoel => ({
  id: j.id,
  jaar: j.jaar,
  commissieDoelBedrag: j.commissie_doel_bedrag ?? undefined,
  dealwaardeDoelBedrag: j.dealwaarde_doel_bedrag ?? undefined,
  notities: j.notities ?? undefined,
});

const jaarDoelToDb = (j: Partial<JaarDoel>) => cleanPayload({
  jaar: j.jaar,
  commissie_doel_bedrag: j.commissieDoelBedrag ?? null,
  dealwaarde_doel_bedrag: j.dealwaardeDoelBedrag ?? null,
  notities: j.notities !== undefined ? (j.notities || null) : undefined,
});

// MAPPERS — REFERENTIE-OBJECTEN
const referentieObjectFromDb = (r: any): ReferentieObject => ({
  id: r.id,
  adres: r.adres ?? '',
  postcode: r.postcode ?? '',
  plaats: r.plaats ?? '',
  assetClass: r.asset_class,
  m2: r.m2 ?? 0,
  vraagprijs: r.vraagprijs ?? 0,
  prijsPerM2: r.prijs_per_m2 != null ? Number(r.prijs_per_m2) : undefined,
  bouwjaar: r.bouwjaar ?? 0,
  energielabel: r.energielabel ?? undefined,
  huurstatus: r.huurstatus ?? undefined,
  huurprijsPerMaand: r.huurprijs_per_maand != null ? Number(r.huurprijs_per_maand) : undefined,
  huurprijsPerJaar: r.huurprijs_per_jaar != null ? Number(r.huurprijs_per_jaar) : undefined,
  bron: r.bron ?? undefined,
  notities: r.notities ?? undefined,
  softDeletedAt: r.soft_deleted_at ?? undefined,
  createdAt: r.created_at ?? undefined,
});

const referentieObjectToDb = (r: Partial<ReferentieObject>) => cleanPayload({
  adres: r.adres,
  postcode: r.postcode,
  plaats: r.plaats,
  asset_class: r.assetClass,
  m2: r.m2,
  vraagprijs: r.vraagprijs,
  bouwjaar: r.bouwjaar,
  energielabel: r.energielabel !== undefined ? (r.energielabel || null) : undefined,
  huurstatus: r.huurstatus !== undefined ? (r.huurstatus || null) : undefined,
  huurprijs_per_maand: r.huurprijsPerMaand !== undefined ? (r.huurprijsPerMaand ?? null) : undefined,
  huurprijs_per_jaar: r.huurprijsPerJaar !== undefined ? (r.huurprijsPerJaar ?? null) : undefined,
  bron: r.bron !== undefined ? (r.bron || null) : undefined,
  notities: r.notities !== undefined ? (r.notities || null) : undefined,
});

const dealReferentieFromDb = (r: any): DealReferentie => ({
  id: r.id,
  dealId: r.deal_id,
  referentieObjectId: r.referentie_object_id,
  notities: r.notities ?? undefined,
});

const objectReferentieFromDb = (r: any): ObjectReferentie => ({
  id: r.id,
  objectId: r.object_id,
  referentieObjectId: r.referentie_object_id,
  notities: r.notities ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
});


// =====================================================================
// CONTEXT
// =====================================================================

interface DataStore {
  // Data
  relaties: Relatie[];
  contactpersonen: RelatieContactpersoon[];
  objecten: ObjectVastgoed[];
  huurders: ObjectHuurder[];
  documenten: ObjectDocument[];
  fotos: ObjectFoto[];
  huurMetrics: Record<string, ObjectHuurMetrics>;
  deals: Deal[];
  taken: Taak[];
  zoekprofielen: Zoekprofiel[];
  dealObjecten: DealObjectKoppeling[];
  dealKandidaten: DealKandidaat[];
  pipelineKandidaten: PipelineKandidaat[];
  pipelines: Pipeline[];
  pipelineStages: PipelineStage[];
  jaarDoelen: JaarDoel[];
  loading: boolean;
  refresh: () => Promise<void>;

  // Relaties
  addRelatie: (r: Omit<Relatie, 'id'>) => Promise<Relatie | null>;
  updateRelatie: (id: string, r: Partial<Relatie>) => Promise<void>;
  deleteRelatie: (id: string) => Promise<void>;
  bulkInsertRelaties: (rows: Partial<Relatie>[]) => Promise<{ ok: number; fout: number }>;

  // Contactpersonen
  addContactpersoon: (c: Omit<RelatieContactpersoon, 'id'>) => Promise<RelatieContactpersoon | null>;
  updateContactpersoon: (id: string, c: Partial<RelatieContactpersoon>) => Promise<void>;
  deleteContactpersoon: (id: string) => Promise<void>;
  getContactpersonenVoorRelatie: (rid: string) => RelatieContactpersoon[];

  // Objecten
  addObject: (o: Omit<ObjectVastgoed, 'id'>) => Promise<ObjectVastgoed | null>;
  updateObject: (id: string, o: Partial<ObjectVastgoed>) => Promise<void>;
  deleteObject: (id: string) => Promise<void>;

  // Huurders
  addHuurder: (h: Omit<ObjectHuurder, 'id'>) => Promise<ObjectHuurder | null>;
  updateHuurder: (id: string, h: Partial<ObjectHuurder>) => Promise<void>;
  deleteHuurder: (id: string) => Promise<void>;
  getHuurdersVoorObject: (oid: string) => ObjectHuurder[];
  getHuurMetrics: (oid: string) => ObjectHuurMetrics | undefined;

  // Documenten
  addDocument: (d: Omit<ObjectDocument, 'id' | 'createdAt'>) => Promise<ObjectDocument | null>;
  deleteDocument: (id: string) => Promise<void>;
  getDocumentenVoorObject: (oid: string) => ObjectDocument[];

  // Foto's
  addFoto: (f: Omit<ObjectFoto, 'id'>) => Promise<ObjectFoto | null>;
  updateFoto: (id: string, f: Partial<ObjectFoto>) => Promise<void>;
  deleteFoto: (id: string) => Promise<void>;
  setHoofdfoto: (objectId: string, fotoId: string) => Promise<void>;
  getFotosVoorObject: (oid: string) => ObjectFoto[];

  // Deals
  addDeal: (d: Omit<Deal, 'id'>) => Promise<Deal | null>;
  updateDeal: (id: string, d: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;

  // Taken
  addTaak: (t: Omit<Taak, 'id'>) => Promise<Taak | null>;
  updateTaak: (id: string, t: Partial<Taak>) => Promise<void>;
  deleteTaak: (id: string) => Promise<void>;

  // Zoekprofielen
  addZoekprofiel: (z: Omit<Zoekprofiel, 'id'>) => Promise<Zoekprofiel | null>;
  updateZoekprofiel: (id: string, z: Partial<Zoekprofiel>) => Promise<void>;
  deleteZoekprofiel: (id: string) => Promise<void>;

  // Deal-koppelingen
  addDealObject: (dealId: string, objectId: string, isPrimair?: boolean) => Promise<void>;
  removeDealObject: (id: string) => Promise<void>;
  setPrimairDealObject: (dealId: string, koppelingId: string) => Promise<void>;
  getObjectenVoorDeal: (dealId: string) => DealObjectKoppeling[];

  addDealKandidaat: (dealId: string, relatieId: string, status?: KandidaatStatus) => Promise<void>;
  updateDealKandidaat: (id: string, patch: { status?: KandidaatStatus; notities?: string }) => Promise<void>;
  removeDealKandidaat: (id: string) => Promise<void>;
  getKandidatenVoorDeal: (dealId: string) => DealKandidaat[];

  // Pipeline (object × relatie)
  addPipelineKandidaat: (input: Omit<PipelineKandidaat, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PipelineKandidaat | null>;
  updatePipelineKandidaat: (id: string, patch: Partial<PipelineKandidaat>) => Promise<void>;
  removePipelineKandidaat: (id: string) => Promise<void>;
  getPipelineVoorObject: (objectId: string) => PipelineKandidaat[];
  getPipelineVoorRelatie: (relatieId: string) => PipelineKandidaat[];

  // Object Pipeline (Pipedrive-stijl)
  getDefaultObjectPipeline: () => Pipeline | undefined;
  getStagesVoorPipeline: (pipelineId: string) => PipelineStage[];
  setObjectPipelineStage: (objectId: string, stageId: string, opts?: { manual?: boolean }) => Promise<void>;

  // Jaar-doelen
  upsertJaarDoel: (doel: Omit<JaarDoel, 'id'>) => Promise<JaarDoel | null>;
  deleteJaarDoel: (id: string) => Promise<void>;
  getJaarDoel: (jaar: number) => JaarDoel | undefined;

  // Referentie-objecten
  referentieObjecten: ReferentieObject[];
  dealReferenties: DealReferentie[];
  objectReferenties: ObjectReferentie[];
  addReferentieObject: (r: Omit<ReferentieObject, 'id' | 'prijsPerM2'>) => Promise<ReferentieObject | null>;
  updateReferentieObject: (id: string, r: Partial<ReferentieObject>) => Promise<void>;
  deleteReferentieObject: (id: string) => Promise<void>;
  koppelReferentieAanDeal: (dealId: string, referentieObjectId: string) => Promise<void>;
  ontkoppelReferentieVanDeal: (koppelingId: string) => Promise<void>;
  getReferentiesVoorDeal: (dealId: string) => ReferentieObject[];
  getReferentiesVoorObject: (objectId: string) => ReferentieObject[];
  koppelReferentieAanObject: (objectId: string, referentieObjectId: string) => Promise<void>;
  ontkoppelReferentieVanObject: (koppelingId: string) => Promise<void>;

  // RPC
  genereerRefnummer: () => Promise<string>;

  // Selectors
  getRelatieById: (id: string) => Relatie | undefined;
  getObjectById: (id: string) => ObjectVastgoed | undefined;
  getDealById: (id: string) => Deal | undefined;
  getDealsByRelatie: (relatieId: string) => Deal[];
  getDealsByObject: (objectId: string) => Deal[];
  getTakenByRelatie: (relatieId: string) => Taak[];
  getTakenByDeal: (dealId: string) => Taak[];
  getZoekprofielenByRelatie: (relatieId: string) => Zoekprofiel[];
}

const DataStoreContext = createContext<DataStore | null>(null);


// =====================================================================
// PROVIDER
// =====================================================================

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const { heeftToegang } = useAuth();

  const [relaties, setRelaties] = useState<Relatie[]>([]);
  const [contactpersonen, setContactpersonen] = useState<RelatieContactpersoon[]>([]);
  const [objecten, setObjecten] = useState<ObjectVastgoed[]>([]);
  const [huurders, setHuurders] = useState<ObjectHuurder[]>([]);
  const [documenten, setDocumenten] = useState<ObjectDocument[]>([]);
  const [fotos, setFotos] = useState<ObjectFoto[]>([]);
  const [huurMetrics, setHuurMetrics] = useState<Record<string, ObjectHuurMetrics>>({});
  const [deals, setDeals] = useState<Deal[]>([]);
  const [taken, setTaken] = useState<Taak[]>([]);
  const [zoekprofielen, setZoekprofielen] = useState<Zoekprofiel[]>([]);
  const [dealObjecten, setDealObjecten] = useState<DealObjectKoppeling[]>([]);
  const [dealKandidaten, setDealKandidaten] = useState<DealKandidaat[]>([]);
  const [pipelineKandidaten, setPipelineKandidaten] = useState<PipelineKandidaat[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [jaarDoelen, setJaarDoelen] = useState<JaarDoel[]>([]);
  const [referentieObjecten, setReferentieObjecten] = useState<ReferentieObject[]>([]);
  const [dealReferenties, setDealReferenties] = useState<DealReferentie[]>([]);
  const [objectReferenties, setObjectReferenties] = useState<ObjectReferentie[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!heeftToegang) return;
    setLoading(true);
    try {
      const [
        relRes, cpRes, objRes, huurRes, docRes, fotoRes, metricsRes,
        dealRes, taakRes, zpRes, doRes, dkRes, jdRes, refRes, drefRes, objRefRes, pipeRes,
        pipeDefRes, pipeStageRes,
      ] = await Promise.all([
        supabase.from('relaties').select('*').is('soft_deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('relatie_contactpersonen' as any).select('*').order('is_primair', { ascending: false }),
        supabase.from('objecten').select('*').is('soft_deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('object_huurders' as any).select('*'),
        supabase.from('object_documenten' as any).select('*').order('created_at', { ascending: false }),
        supabase.from('object_fotos' as any).select('*').order('volgorde', { ascending: true }),
        supabase.from('object_huur_metrics' as any).select('*'),
        supabase.from('deals').select('*').is('soft_deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('taken').select('*').is('soft_deleted_at', null).order('deadline', { ascending: true, nullsFirst: false }),
        supabase.from('zoekprofielen').select('*').order('created_at', { ascending: false }),
        supabase.from('deal_objecten' as any).select('*'),
        supabase.from('deal_kandidaten' as any).select('*'),
        supabase.from('jaar_doelen' as any).select('*').order('jaar', { ascending: false }),
        supabase.from('referentie_objecten' as any).select('*').is('soft_deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('deal_referenties' as any).select('*'),
        supabase.from('object_referenties' as any).select('*'),
        supabase.from('object_pipeline' as any).select('*').is('soft_deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('pipelines' as any).select('*').eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('pipeline_stages' as any).select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);

      if (relRes.data) setRelaties(relRes.data.map(relatieFromDb));
      if (cpRes.data) setContactpersonen((cpRes.data as any[]).map(contactpersoonFromDb));
      if (objRes.data) setObjecten(objRes.data.map(objectFromDb));
      if (huurRes.data) setHuurders((huurRes.data as any[]).map(huurderFromDb));
      if (docRes.data) setDocumenten((docRes.data as any[]).map(documentFromDb));
      if (fotoRes.data) setFotos((fotoRes.data as any[]).map(fotoFromDb));
      if (metricsRes.data) {
        const map: Record<string, ObjectHuurMetrics> = {};
        (metricsRes.data as any[]).forEach(m => {
          const mm = huurMetricsFromDb(m);
          map[mm.objectId] = mm;
        });
        setHuurMetrics(map);
      }
      if (dealRes.data) setDeals(dealRes.data.map(dealFromDb));
      if (taakRes.data) setTaken(taakRes.data.map(taakFromDb));
      if (zpRes.data) setZoekprofielen(zpRes.data.map(zoekprofielFromDb));
      if (doRes.data) setDealObjecten((doRes.data as any[]).map(dealObjectFromDb));
      if (dkRes.data) setDealKandidaten((dkRes.data as any[]).map(dealKandidaatFromDb));
      if (jdRes.data) setJaarDoelen((jdRes.data as any[]).map(jaarDoelFromDb));
      if (refRes.data) setReferentieObjecten((refRes.data as any[]).map(referentieObjectFromDb));
      if (drefRes.data) setDealReferenties((drefRes.data as any[]).map(dealReferentieFromDb));
      if (objRefRes.data) setObjectReferenties((objRefRes.data as any[]).map(objectReferentieFromDb));
      if (pipeRes.data) setPipelineKandidaten((pipeRes.data as any[]).map(pipelineFromDb));
      if (pipeDefRes.data) setPipelines((pipeDefRes.data as any[]).map(pipelineDefFromDb));
      if (pipeStageRes.data) setPipelineStages((pipeStageRes.data as any[]).map(pipelineStageFromDb));
    } finally {
      setLoading(false);
    }
  }, [heeftToegang]);

  useEffect(() => {
    if (heeftToegang) refresh();
  }, [heeftToegang, refresh]);


  // -------- RELATIES --------
  const addRelatie = useCallback(async (r: Omit<Relatie, 'id'>) => {
    const { data, error } = await supabase.from('relaties').insert(relatieToDb(r) as any).select().single();
    throwIfError(error);
    const nieuw = relatieFromDb(data);
    setRelaties(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateRelatie = useCallback(async (id: string, r: Partial<Relatie>) => {
    const { data, error } = await supabase.from('relaties').update(relatieToDb(r) as any).eq('id', id).select().single();
    throwIfError(error);
    setRelaties(prev => prev.map(x => x.id === id ? relatieFromDb(data) : x));
  }, []);

  const deleteRelatie = useCallback(async (id: string) => {
    // Soft delete
    const { error } = await supabase.from('relaties').update({ soft_deleted_at: new Date().toISOString() } as any).eq('id', id);
    throwIfError(error);
    setRelaties(prev => prev.filter(x => x.id !== id));
    setDeals(prev => prev.filter(d => d.relatieId !== id));
  }, []);

  const bulkInsertRelaties = useCallback(async (rows: Partial<Relatie>[]) => {
    if (rows.length === 0) return { ok: 0, fout: 0 };
    const payload = rows.map(r => relatieToDb({
      leadStatus: 'lauw', type: 'belegger', regio: [], assetClasses: [], ndaGetekend: false, ...r,
    }) as any);
    const { data, error } = await supabase.from('relaties').insert(payload).select();
    if (error) {
      console.error('Bulk insert mislukt:', error);
      throw new Error('Bulk import mislukt. Controleer de invoer.');
    }
    const nieuwe = (data ?? []).map(relatieFromDb);
    setRelaties(prev => [...nieuwe, ...prev]);
    return { ok: nieuwe.length, fout: rows.length - nieuwe.length };
  }, []);

  // -------- CONTACTPERSONEN --------
  const addContactpersoon = useCallback(async (c: Omit<RelatieContactpersoon, 'id'>) => {
    const { data, error } = await supabase.from('relatie_contactpersonen' as any).insert(contactpersoonToDb(c) as any).select().single();
    throwIfError(error);
    if (!data) throw new Error('Contactpersoon niet aangemaakt — geen data ontvangen van de database. Probeer opnieuw.');
    const nieuw = contactpersoonFromDb(data);
    setContactpersonen(prev => [...prev, nieuw]);
    return nieuw;
  }, []);

  const updateContactpersoon = useCallback(async (id: string, c: Partial<RelatieContactpersoon>) => {
    const { data, error } = await supabase.from('relatie_contactpersonen' as any).update(contactpersoonToDb(c) as any).eq('id', id).select().single();
    throwIfError(error);
    if (!data) throw new Error('Contactpersoon niet bijgewerkt — bewerking heeft geen rij geraakt. Mogelijk is de contactpersoon verwijderd of heb je geen rechten.');
    setContactpersonen(prev => prev.map(x => x.id === id ? contactpersoonFromDb(data) : x));
  }, []);

  const deleteContactpersoon = useCallback(async (id: string) => {
    const { error } = await supabase.from('relatie_contactpersonen' as any).delete().eq('id', id);
    throwIfError(error);
    setContactpersonen(prev => prev.filter(x => x.id !== id));
  }, []);

  // -------- OBJECTEN --------
  const addObject = useCallback(async (o: Omit<ObjectVastgoed, 'id'>) => {
    const { data, error } = await supabase.from('objecten').insert(objectToDb(o) as any).select().single();
    throwIfError(error);
    const nieuw = objectFromDb(data);
    setObjecten(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateObject = useCallback(async (id: string, o: Partial<ObjectVastgoed>) => {
    const { data, error } = await supabase.from('objecten').update(objectToDb(o) as any).eq('id', id).select().single();
    throwIfError(error);
    setObjecten(prev => prev.map(x => x.id === id ? objectFromDb(data) : x));
  }, []);

  const deleteObject = useCallback(async (id: string) => {
    // Verzamel storage-paden zodat we de bestanden ook opruimen
    const paths: string[] = [
      ...documenten.filter(d => d.objectId === id).map(d => d.storagePath),
      ...fotos.filter(f => f.objectId === id).map(f => f.storagePath),
    ];
    const { error } = await supabase.from('objecten').update({ soft_deleted_at: new Date().toISOString() } as any).eq('id', id);
    throwIfError(error);
    setObjecten(prev => prev.filter(x => x.id !== id));
    // Files opruimen (best effort — niet blocking)
    if (paths.length > 0) deleteBestanden(paths).catch(() => void 0);
  }, [documenten, fotos]);

  // -------- HUURDERS --------
  const addHuurder = useCallback(async (h: Omit<ObjectHuurder, 'id'>) => {
    const { data, error } = await supabase.from('object_huurders' as any).insert(huurderToDb(h) as any).select().single();
    throwIfError(error);
    const nieuw = huurderFromDb(data);
    setHuurders(prev => [...prev, nieuw]);
    refresh(); // herlaadt huur_metrics view
    return nieuw;
  }, [refresh]);

  const updateHuurder = useCallback(async (id: string, h: Partial<ObjectHuurder>) => {
    const { data, error } = await supabase.from('object_huurders' as any).update(huurderToDb(h) as any).eq('id', id).select().single();
    throwIfError(error);
    setHuurders(prev => prev.map(x => x.id === id ? huurderFromDb(data) : x));
    refresh();
  }, [refresh]);

  const deleteHuurder = useCallback(async (id: string) => {
    const { error } = await supabase.from('object_huurders' as any).delete().eq('id', id);
    throwIfError(error);
    setHuurders(prev => prev.filter(x => x.id !== id));
    refresh();
  }, [refresh]);

  // -------- DOCUMENTEN --------
  const addDocument = useCallback(async (d: Omit<ObjectDocument, 'id' | 'createdAt'>) => {
    const payload = cleanPayload({
      object_id: d.objectId,
      documenttype: d.documenttype,
      bestandsnaam: d.bestandsnaam,
      storage_path: d.storagePath,
      bestandsgrootte_bytes: d.bestandsgrootteBytes ?? null,
      mime_type: d.mimeType ?? null,
      vertrouwelijk: d.vertrouwelijk,
      notities: d.notities ?? null,
      geupload_door: d.geuploadDoor ?? null,
    });
    const { data, error } = await supabase.from('object_documenten' as any).insert(payload as any).select().single();
    throwIfError(error);
    const nieuw = documentFromDb(data);
    setDocumenten(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const doc = documenten.find(d => d.id === id);
    const { error } = await supabase.from('object_documenten' as any).delete().eq('id', id);
    throwIfError(error);
    setDocumenten(prev => prev.filter(x => x.id !== id));
    if (doc?.storagePath) deleteBestanden([doc.storagePath]).catch(() => void 0);
  }, [documenten]);

  // -------- FOTO'S --------
  const addFoto = useCallback(async (f: Omit<ObjectFoto, 'id'>) => {
    const payload = cleanPayload({
      object_id: f.objectId,
      storage_path: f.storagePath,
      bijschrift: f.bijschrift ?? null,
      is_hoofdfoto: f.isHoofdfoto,
      volgorde: f.volgorde,
      bestandsgrootte_bytes: f.bestandsgrootteBytes ?? null,
    });
    const { data, error } = await supabase.from('object_fotos' as any).insert(payload as any).select().single();
    throwIfError(error);
    const nieuw = fotoFromDb(data);
    setFotos(prev => [...prev, nieuw]);
    return nieuw;
  }, []);

  const updateFoto = useCallback(async (id: string, f: Partial<ObjectFoto>) => {
    const payload = cleanPayload({
      bijschrift: f.bijschrift !== undefined ? (f.bijschrift || null) : undefined,
      is_hoofdfoto: f.isHoofdfoto,
      volgorde: f.volgorde,
    });
    const { data, error } = await supabase.from('object_fotos' as any).update(payload as any).eq('id', id).select().single();
    throwIfError(error);
    setFotos(prev => prev.map(x => x.id === id ? fotoFromDb(data) : x));
  }, []);

  const deleteFoto = useCallback(async (id: string) => {
    const foto = fotos.find(f => f.id === id);
    const { error } = await supabase.from('object_fotos' as any).delete().eq('id', id);
    throwIfError(error);
    setFotos(prev => prev.filter(x => x.id !== id));
    if (foto?.storagePath) deleteBestanden([foto.storagePath]).catch(() => void 0);
  }, [fotos]);

  const setHoofdfoto = useCallback(async (objectId: string, fotoId: string) => {
    // Alleen één hoofdfoto per object — eerst allen op false zetten
    const { error: e1 } = await supabase.from('object_fotos' as any).update({ is_hoofdfoto: false } as any).eq('object_id', objectId);
    throwIfError(e1);
    const { error: e2 } = await supabase.from('object_fotos' as any).update({ is_hoofdfoto: true } as any).eq('id', fotoId);
    throwIfError(e2);
    setFotos(prev => prev.map(f =>
      f.objectId === objectId ? { ...f, isHoofdfoto: f.id === fotoId } : f
    ));
  }, []);

  // -------- DEALS --------
  const addDeal = useCallback(async (d: Omit<Deal, 'id'>) => {
    const { data, error } = await supabase.from('deals').insert(dealToDb(d) as any).select().single();
    throwIfError(error);
    const nieuw = dealFromDb(data);
    setDeals(prev => [nieuw, ...prev]);
    if (nieuw.objectId) {
      await supabase.from('deal_objecten' as any).insert({ deal_id: nieuw.id, object_id: nieuw.objectId, is_primair: true } as any);
    }
    if (nieuw.relatieId) {
      await supabase.from('deal_kandidaten' as any).insert({ deal_id: nieuw.id, relatie_id: nieuw.relatieId, status: 'geinteresseerd' } as any);
    }
    await refresh();
    return nieuw;
  }, [refresh]);

  const updateDeal = useCallback(async (id: string, d: Partial<Deal>) => {
    const { data, error } = await supabase.from('deals').update(dealToDb(d) as any).eq('id', id).select().single();
    throwIfError(error);
    setDeals(prev => prev.map(x => x.id === id ? dealFromDb(data) : x));
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    const { error } = await supabase.from('deals').update({ soft_deleted_at: new Date().toISOString() } as any).eq('id', id);
    throwIfError(error);
    setDeals(prev => prev.filter(x => x.id !== id));
    setDealObjecten(prev => prev.filter(x => x.dealId !== id));
    setDealKandidaten(prev => prev.filter(x => x.dealId !== id));
  }, []);

  // -------- TAKEN --------
  const addTaak = useCallback(async (t: Omit<Taak, 'id'>) => {
    const { data, error } = await supabase.from('taken').insert(taakToDb(t) as any).select().single();
    throwIfError(error);
    const nieuw = taakFromDb(data);
    setTaken(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateTaak = useCallback(async (id: string, t: Partial<Taak>) => {
    const { data, error } = await supabase.from('taken').update(taakToDb(t) as any).eq('id', id).select().single();
    throwIfError(error);
    setTaken(prev => prev.map(x => x.id === id ? taakFromDb(data) : x));
  }, []);

  const deleteTaak = useCallback(async (id: string) => {
    const { error } = await supabase.from('taken').update({ soft_deleted_at: new Date().toISOString() } as any).eq('id', id);
    throwIfError(error);
    setTaken(prev => prev.filter(x => x.id !== id));
  }, []);

  // -------- ZOEKPROFIELEN --------
  const addZoekprofiel = useCallback(async (z: Omit<Zoekprofiel, 'id'>) => {
    const { data, error } = await supabase.from('zoekprofielen').insert(zoekprofielToDb(z) as any).select().single();
    throwIfError(error);
    const nieuw = zoekprofielFromDb(data);
    setZoekprofielen(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateZoekprofiel = useCallback(async (id: string, z: Partial<Zoekprofiel>) => {
    const { data, error } = await supabase.from('zoekprofielen').update(zoekprofielToDb(z) as any).eq('id', id).select().single();
    throwIfError(error);
    setZoekprofielen(prev => prev.map(x => x.id === id ? zoekprofielFromDb(data) : x));
  }, []);

  const deleteZoekprofiel = useCallback(async (id: string) => {
    const { error } = await supabase.from('zoekprofielen').delete().eq('id', id);
    throwIfError(error);
    setZoekprofielen(prev => prev.filter(x => x.id !== id));
  }, []);

  // -------- DEAL-KOPPELINGEN --------
  const addDealObject = useCallback(async (dealId: string, objectId: string, isPrimair = false) => {
    const { data, error } = await supabase.from('deal_objecten' as any)
      .insert({ deal_id: dealId, object_id: objectId, is_primair: isPrimair } as any)
      .select().single();
    throwIfError(error);
    setDealObjecten(prev => [...prev, dealObjectFromDb(data)]);
  }, []);

  const removeDealObject = useCallback(async (id: string) => {
    const { error } = await supabase.from('deal_objecten' as any).delete().eq('id', id);
    throwIfError(error);
    setDealObjecten(prev => prev.filter(x => x.id !== id));
  }, []);

  const setPrimairDealObject = useCallback(async (dealId: string, koppelingId: string) => {
    const { error: e1 } = await supabase.from('deal_objecten' as any).update({ is_primair: false } as any).eq('deal_id', dealId);
    throwIfError(e1);
    const { error: e2 } = await supabase.from('deal_objecten' as any).update({ is_primair: true } as any).eq('id', koppelingId);
    throwIfError(e2);
    const koppeling = dealObjecten.find(x => x.id === koppelingId);
    if (koppeling) {
      await supabase.from('deals').update({ object_id: koppeling.objectId }).eq('id', dealId);
    }
    await refresh();
  }, [dealObjecten, refresh]);

  const addDealKandidaat = useCallback(async (dealId: string, relatieId: string, status: KandidaatStatus = 'geinteresseerd') => {
    const { data, error } = await supabase.from('deal_kandidaten' as any)
      .insert({ deal_id: dealId, relatie_id: relatieId, status } as any)
      .select().single();
    throwIfError(error);
    setDealKandidaten(prev => [...prev, dealKandidaatFromDb(data)]);
  }, []);

  const updateDealKandidaat = useCallback(async (id: string, patch: { status?: KandidaatStatus; notities?: string }) => {
    const { data, error } = await supabase.from('deal_kandidaten' as any)
      .update(cleanPayload(patch) as any).eq('id', id).select().single();
    throwIfError(error);
    setDealKandidaten(prev => prev.map(x => x.id === id ? dealKandidaatFromDb(data) : x));
  }, []);

  const removeDealKandidaat = useCallback(async (id: string) => {
    const { error } = await supabase.from('deal_kandidaten' as any).delete().eq('id', id);
    throwIfError(error);
    setDealKandidaten(prev => prev.filter(x => x.id !== id));
  }, []);

  // -------- PIPELINE (object × relatie) --------
  const addPipelineKandidaat = useCallback(async (input: Omit<PipelineKandidaat, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { data, error } = await supabase.from('object_pipeline' as any)
      .insert(pipelineToDb(input) as any).select().single();
    throwIfError(error);
    if (!data) return null;
    const nieuw = pipelineFromDb(data);
    setPipelineKandidaten(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updatePipelineKandidaat = useCallback(async (id: string, patch: Partial<PipelineKandidaat>) => {
    const { data, error } = await supabase.from('object_pipeline' as any)
      .update(pipelineToDb(patch) as any).eq('id', id).select().single();
    throwIfError(error);
    if (!data) return;
    setPipelineKandidaten(prev => prev.map(x => x.id === id ? pipelineFromDb(data) : x));
  }, []);

  const removePipelineKandidaat = useCallback(async (id: string) => {
    const { error } = await supabase.from('object_pipeline' as any)
      .update({ soft_deleted_at: new Date().toISOString() } as any).eq('id', id);
    throwIfError(error);
    setPipelineKandidaten(prev => prev.filter(x => x.id !== id));
  }, []);

  const upsertJaarDoel = useCallback(async (doel: Omit<JaarDoel, 'id'>) => {
    const { data, error } = await supabase
      .from('jaar_doelen' as any)
      .upsert(jaarDoelToDb(doel) as any, { onConflict: 'jaar' })
      .select().single();
    throwIfError(error);
    const nieuw = jaarDoelFromDb(data);
    setJaarDoelen(prev => {
      const zonder = prev.filter(x => x.jaar !== nieuw.jaar);
      return [nieuw, ...zonder].sort((a, b) => b.jaar - a.jaar);
    });
    return nieuw;
  }, []);

  const deleteJaarDoel = useCallback(async (id: string) => {
    const { error } = await supabase.from('jaar_doelen' as any).delete().eq('id', id);
    throwIfError(error);
    setJaarDoelen(prev => prev.filter(x => x.id !== id));
  }, []);

  // -------- REFERENTIE-OBJECTEN --------
  const addReferentieObject = useCallback(async (r: Omit<ReferentieObject, 'id' | 'prijsPerM2'>) => {
    const { data, error } = await supabase.from('referentie_objecten' as any)
      .insert(referentieObjectToDb(r) as any).select().single();
    throwIfError(error);
    const nieuw = referentieObjectFromDb(data);
    setReferentieObjecten(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateReferentieObject = useCallback(async (id: string, r: Partial<ReferentieObject>) => {
    const { data, error } = await supabase.from('referentie_objecten' as any)
      .update(referentieObjectToDb(r) as any).eq('id', id).select().single();
    throwIfError(error);
    setReferentieObjecten(prev => prev.map(x => x.id === id ? referentieObjectFromDb(data) : x));
  }, []);

  const deleteReferentieObject = useCallback(async (id: string) => {
    // Soft delete — ON DELETE CASCADE op deal_referenties zou anders losse koppelingen wegvegen.
    const { error } = await supabase.from('referentie_objecten' as any)
      .update({ soft_deleted_at: new Date().toISOString() } as any).eq('id', id);
    throwIfError(error);
    setReferentieObjecten(prev => prev.filter(x => x.id !== id));
  }, []);

  const koppelReferentieAanDeal = useCallback(async (dealId: string, referentieObjectId: string) => {
    const { data, error } = await supabase.from('deal_referenties' as any)
      .insert({ deal_id: dealId, referentie_object_id: referentieObjectId } as any)
      .select().single();
    throwIfError(error);
    setDealReferenties(prev => [...prev, dealReferentieFromDb(data)]);
  }, []);

  const ontkoppelReferentieVanDeal = useCallback(async (koppelingId: string) => {
    const { error } = await supabase.from('deal_referenties' as any).delete().eq('id', koppelingId);
    throwIfError(error);
    setDealReferenties(prev => prev.filter(x => x.id !== koppelingId));
  }, []);

  // -------- OBJECT-REFERENTIES --------
  const getReferentiesVoorObject = useCallback((objectId: string): ReferentieObject[] => {
    const refIds = objectReferenties
      .filter(or => or.objectId === objectId)
      .map(or => or.referentieObjectId);
    return referentieObjecten.filter(r => refIds.includes(r.id));
  }, [objectReferenties, referentieObjecten]);

  const koppelReferentieAanObject = useCallback(async (objectId: string, referentieObjectId: string) => {
    const { data, error } = await supabase.from('object_referenties' as any)
      .insert({ object_id: objectId, referentie_object_id: referentieObjectId } as any)
      .select().single();
    throwIfError(error);
    if (!data) throw new Error('Koppeling niet aangemaakt');
    setObjectReferenties(prev => [...prev, objectReferentieFromDb(data)]);
  }, []);

  const ontkoppelReferentieVanObject = useCallback(async (koppelingId: string) => {
    const { error } = await supabase.from('object_referenties' as any).delete().eq('id', koppelingId);
    throwIfError(error);
    setObjectReferenties(prev => prev.filter(x => x.id !== koppelingId));
  }, []);

  // -------- RPC: refnummer generator --------
  const genereerRefnummer = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_refnummer' as any);
    if (error) {
      console.error('generate_refnummer RPC mislukt:', error);
      // Fallback client-side
      const jaar = new Date().getFullYear();
      return `BITO-${jaar}-${Date.now().toString().slice(-4)}`;
    }
    return (data as string) ?? `BITO-${new Date().getFullYear()}-001`;
  }, []);

  // -------- OBJECT PIPELINE (Pipedrive-stijl) --------
  const setObjectPipelineStage = useCallback(async (
    objectId: string,
    stageId: string,
    opts: { manual?: boolean } = {},
  ) => {
    const obj = objecten.find(o => o.id === objectId);
    if (!obj) throw new Error('Object niet gevonden');

    // Automatische voortgang mag handmatige lock niet overschrijven
    if (!opts.manual && obj.pipelineStageLocked) return;

    const stage = pipelineStages.find(s => s.id === stageId);
    if (!stage) throw new Error('Pipeline-fase niet gevonden');

    const patch: any = {
      pipeline_stage_id: stageId,
      pipeline_id: stage.pipelineId,
      pipeline_updated_at: new Date().toISOString(),
    };
    if (opts.manual) patch.pipeline_stage_locked = true;

    const { data, error } = await supabase.from('objecten')
      .update(patch).eq('id', objectId).select().single();
    throwIfError(error);
    setObjecten(prev => prev.map(x => x.id === objectId ? objectFromDb(data) : x));
  }, [objecten, pipelineStages]);

  const store: DataStore = {
    relaties, contactpersonen, objecten, huurders, documenten, fotos, huurMetrics,
    deals, taken, zoekprofielen, dealObjecten, dealKandidaten, jaarDoelen, loading, refresh,

    addRelatie, updateRelatie, deleteRelatie, bulkInsertRelaties,
    addContactpersoon, updateContactpersoon, deleteContactpersoon,
    getContactpersonenVoorRelatie: (rid) => contactpersonen.filter(c => c.relatieId === rid),

    addObject, updateObject, deleteObject,
    addHuurder, updateHuurder, deleteHuurder,
    getHuurdersVoorObject: (oid) => huurders.filter(h => h.objectId === oid),
    getHuurMetrics: (oid) => huurMetrics[oid],

    addDocument, deleteDocument,
    getDocumentenVoorObject: (oid) => documenten.filter(d => d.objectId === oid),

    addFoto, updateFoto, deleteFoto, setHoofdfoto,
    getFotosVoorObject: (oid) => fotos.filter(f => f.objectId === oid).sort((a, b) => a.volgorde - b.volgorde),

    addDeal, updateDeal, deleteDeal,
    addTaak, updateTaak, deleteTaak,
    addZoekprofiel, updateZoekprofiel, deleteZoekprofiel,

    addDealObject, removeDealObject, setPrimairDealObject,
    getObjectenVoorDeal: (dealId) => dealObjecten.filter(x => x.dealId === dealId),

    addDealKandidaat, updateDealKandidaat, removeDealKandidaat,
    getKandidatenVoorDeal: (dealId) => dealKandidaten.filter(x => x.dealId === dealId),

    pipelineKandidaten,
    addPipelineKandidaat, updatePipelineKandidaat, removePipelineKandidaat,
    getPipelineVoorObject: (objectId) => pipelineKandidaten.filter(x => x.objectId === objectId),
    getPipelineVoorRelatie: (relatieId) => pipelineKandidaten.filter(x => x.relatieId === relatieId),

    pipelines, pipelineStages,
    getDefaultObjectPipeline: () => pipelines.find(p => p.entityType === 'object' && p.isDefault) ?? pipelines.find(p => p.entityType === 'object'),
    getStagesVoorPipeline: (pipelineId: string) =>
      pipelineStages.filter(s => s.pipelineId === pipelineId).sort((a, b) => a.sortOrder - b.sortOrder),
    setObjectPipelineStage,

    upsertJaarDoel, deleteJaarDoel,
    getJaarDoel: (jaar) => jaarDoelen.find(j => j.jaar === jaar),

    referentieObjecten, dealReferenties, objectReferenties,
    addReferentieObject, updateReferentieObject, deleteReferentieObject,
    koppelReferentieAanDeal, ontkoppelReferentieVanDeal,
    getReferentiesVoorDeal: (dealId) => {
      const ids = new Set(dealReferenties.filter(x => x.dealId === dealId).map(x => x.referentieObjectId));
      return referentieObjecten.filter(r => ids.has(r.id));
    },
    getReferentiesVoorObject,
    koppelReferentieAanObject,
    ontkoppelReferentieVanObject,

    genereerRefnummer,

    getRelatieById: (id) => relaties.find(r => r.id === id),
    getObjectById: (id) => objecten.find(o => o.id === id),
    getDealById: (id) => deals.find(d => d.id === id),
    getDealsByRelatie: (rid) => {
      const directIds = new Set(deals.filter(d => d.relatieId === rid).map(d => d.id));
      dealKandidaten.filter(k => k.relatieId === rid).forEach(k => directIds.add(k.dealId));
      return deals.filter(d => directIds.has(d.id));
    },
    getDealsByObject: (oid) => {
      const ids = new Set(deals.filter(d => d.objectId === oid).map(d => d.id));
      dealObjecten.filter(k => k.objectId === oid).forEach(k => ids.add(k.dealId));
      return deals.filter(d => ids.has(d.id));
    },
    getTakenByRelatie: (rid) => taken.filter(t => t.relatieId === rid),
    getTakenByDeal: (did) => taken.filter(t => t.dealId === did),
    getZoekprofielenByRelatie: (rid) => zoekprofielen.filter(z => z.relatieId === rid),
  };

  return <DataStoreContext.Provider value={store}>{children}</DataStoreContext.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore must be used within DataStoreProvider');
  return ctx;
}
