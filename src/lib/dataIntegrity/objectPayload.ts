import type { ObjectVastgoed } from '@/data/mock-data';

const OBJECT_CLEAR_GUARD_META = '__allowClearFields';

export type GuardedObjectPatch = Partial<ObjectVastgoed> & {
  [OBJECT_CLEAR_GUARD_META]?: string[];
};

export function stripUndefinedEntries<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === OBJECT_CLEAR_GUARD_META) continue;
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

export function objectToDbPayload(o: Partial<ObjectVastgoed>): Record<string, unknown> {
  return stripUndefinedEntries({
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
    status: o.status,
    aanbiedingswijze: o.aanbiedingswijze !== undefined ? o.aanbiedingswijze : undefined,
    beschikbaar_vanaf: o.beschikbaarVanaf !== undefined ? (o.beschikbaarVanaf || null) : undefined,
    bron: o.bron !== undefined ? (o.bron || null) : undefined,
    exclusief: o.exclusief,
    vraagprijs: o.vraagprijs !== undefined ? o.vraagprijs : undefined,
    prijsindicatie: o.prijsindicatie !== undefined ? (o.prijsindicatie || null) : undefined,
    huurinkomsten: o.huurinkomsten !== undefined ? o.huurinkomsten : undefined,
    huur_per_m2: o.huurPerM2 !== undefined ? o.huurPerM2 : undefined,
    bruto_aanvangsrendement: o.brutoAanvangsrendement !== undefined ? o.brutoAanvangsrendement : undefined,
    netto_aanvangsrendement: o.nettoAanvangsrendement !== undefined ? o.nettoAanvangsrendement : undefined,
    noi: o.noi !== undefined ? o.noi : undefined,
    servicekosten_jaar: o.servicekostenJaar !== undefined ? o.servicekostenJaar : undefined,
    woz_waarde: o.wozWaarde !== undefined ? o.wozWaarde : undefined,
    woz_peildatum: o.wozPeildatum !== undefined ? (o.wozPeildatum || null) : undefined,
    taxatiewaarde: o.taxatiewaarde !== undefined ? o.taxatiewaarde : undefined,
    taxatiedatum: o.taxatiedatum !== undefined ? (o.taxatiedatum || null) : undefined,
    verhuurstatus: o.verhuurStatus,
    aantal_huurders: o.aantalHuurders !== undefined ? o.aantalHuurders : undefined,
    leegstand_pct: o.leegstandPct !== undefined ? o.leegstandPct : undefined,
    oppervlakte: o.oppervlakte !== undefined ? o.oppervlakte : undefined,
    oppervlakte_vvo: o.oppervlakteVvo !== undefined ? o.oppervlakteVvo : undefined,
    oppervlakte_bvo: o.oppervlakteBvo !== undefined ? o.oppervlakteBvo : undefined,
    oppervlakte_gbo: o.oppervlakteGbo !== undefined ? o.oppervlakteGbo : undefined,
    perceel_oppervlakte: o.perceelOppervlakte !== undefined ? o.perceelOppervlakte : undefined,
    bouwjaar: o.bouwjaar !== undefined ? o.bouwjaar : undefined,
    energielabel: o.energielabel !== undefined ? (o.energielabel || null) : undefined,
    energielabel_v2: o.energielabelV2 !== undefined ? (o.energielabelV2 || null) : undefined,
    huidig_gebruik: o.huidigGebruik !== undefined ? (o.huidigGebruik || null) : undefined,
    aantal_verdiepingen: o.aantalVerdiepingen !== undefined ? o.aantalVerdiepingen : undefined,
    aantal_units: o.aantalUnits !== undefined ? o.aantalUnits : undefined,
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
    potentie_omschrijving: o.potentieOmschrijving !== undefined ? (o.potentieOmschrijving || null) : undefined,
    potentie_strategie: o.potentieStrategie !== undefined ? (o.potentieStrategie || null) : undefined,
    potentie_extra_m2: o.potentieExtraM2 !== undefined ? o.potentieExtraM2 : undefined,
    potentie_extra_units: o.potentieExtraUnits !== undefined ? o.potentieExtraUnits : undefined,
    potentie_onderbouwing_status: o.potentieOnderbouwingStatus !== undefined ? (o.potentieOnderbouwingStatus || null) : undefined,
    potentie_afhankelijkheden: o.potentieAfhankelijkheden !== undefined ? (o.potentieAfhankelijkheden || null) : undefined,
    potentie_bron: o.potentieBron !== undefined ? (o.potentieBron || null) : undefined,
    samenvatting: o.samenvatting !== undefined ? (o.samenvatting || null) : undefined,
    investeringsthese: o.investeringsthese !== undefined ? (o.investeringsthese || null) : undefined,
    risicos: o.risicos !== undefined ? (o.risicos || null) : undefined,
    onderscheidende_kenmerken: o.onderscheidendeKenmerken !== undefined ? (o.onderscheidendeKenmerken || null) : undefined,
    verkoper_naam: o.verkoperNaam !== undefined ? (o.verkoperNaam || null) : undefined,
    verkoper_rol: o.verkoperRol !== undefined ? (o.verkoperRol || null) : undefined,
    verkoper_via: o.verkoperVia,
    verkoper_telefoon: o.verkoperTelefoon !== undefined ? (o.verkoperTelefoon || null) : undefined,
    verkoper_email: o.verkoperEmail !== undefined ? (o.verkoperEmail || null) : undefined,
    eigenaar_relatie_id: o.eigenaarRelatieId !== undefined ? (o.eigenaarRelatieId || null) : undefined,
    verkoopmotivatie: o.verkoopmotivatie !== undefined ? (o.verkoopmotivatie || null) : undefined,

    is_portefeuille: o.isPortefeuille,
    parent_object_id: o.parentObjectId !== undefined ? (o.parentObjectId || null) : undefined,
    documentatie_beschikbaar: o.documentenBeschikbaar,
    markeer_als_referentie: o.markeerAlsReferentie,
    interne_opmerkingen: o.interneOpmerkingen !== undefined ? (o.interneOpmerkingen || null) : undefined,
    opmerkingen: o.opmerkingen !== undefined ? (o.opmerkingen || null) : undefined,
    referentieanalyse_zichtbaar: o.referentieanalyseZichtbaar,
    pipeline_id: o.pipelineId !== undefined ? (o.pipelineId || null) : undefined,
    pipeline_stage_id: o.pipelineStageId !== undefined ? (o.pipelineStageId || null) : undefined,
    pipeline_updated_at: o.pipelineUpdatedAt !== undefined ? (o.pipelineUpdatedAt || null) : undefined,
    pipeline_stage_locked: o.pipelineStageLocked,
    propositie: o.propositie !== undefined ? (o.propositie || null) : undefined,
    objectomschrijving: o.objectomschrijving !== undefined ? (o.objectomschrijving || null) : undefined,
    locatie_omschrijving: o.locatieOmschrijving !== undefined ? (o.locatieOmschrijving || null) : undefined,
    technische_staat_omschrijving: o.technischeStaatOmschrijving !== undefined ? (o.technischeStaatOmschrijving || null) : undefined,
    proces_voorwaarden: o.procesVoorwaarden !== undefined ? (o.procesVoorwaarden || null) : undefined,
    dataroom_url: o.dataroomUrl !== undefined ? (o.dataroomUrl || null) : undefined,
    marktwaarde_indicatie: o.marktwaardeIndicatie !== undefined ? o.marktwaardeIndicatie : undefined,
    marktwaarde_bron: o.marktwaardeBron !== undefined ? (o.marktwaardeBron || null) : undefined,
    contact_naam: o.contactNaam !== undefined ? (o.contactNaam || null) : undefined,
    contact_functie: o.contactFunctie !== undefined ? (o.contactFunctie || null) : undefined,
    contact_telefoon: o.contactTelefoon !== undefined ? (o.contactTelefoon || null) : undefined,
    contact_email: o.contactEmail !== undefined ? (o.contactEmail || null) : undefined,
    oppervlakten_per_verdieping: o.oppervlaktenPerVerdieping !== undefined ? (o.oppervlaktenPerVerdieping ?? []) : undefined,
    financiele_scenarios: o.financieleScenarios !== undefined ? (o.financieleScenarios ?? {}) : undefined,
    documentatie_status: o.documentatieStatus !== undefined ? (o.documentatieStatus ?? {}) : undefined,
    im_secties_zichtbaar: o.imSectiesZichtbaar !== undefined ? (o.imSectiesZichtbaar ?? {}) : undefined,
    is_archived: o.isArchived,
    archived_at: o.archivedAt !== undefined ? (o.archivedAt || null) : undefined,
    archived_reason: o.archivedReason !== undefined ? (o.archivedReason || null) : undefined,
    archived_note: o.archivedNote !== undefined ? (o.archivedNote || null) : undefined,
  });
}

export function withExplicitObjectClearFields<T extends Partial<ObjectVastgoed>>(patch: T, fields: (keyof ObjectVastgoed)[]): GuardedObjectPatch {
  return { ...patch, [OBJECT_CLEAR_GUARD_META]: fields as string[] };
}

const PROTECTED_OBJECT_FIELDS: (keyof ObjectVastgoed)[] = [
  'vraagprijs',
  'huurinkomsten',
  'huurPerM2',
  'brutoAanvangsrendement',
  'nettoAanvangsrendement',
  'noi',
  'servicekostenJaar',
  'wozWaarde',
  'taxatiewaarde',
  'oppervlakte',
  'oppervlakteVvo',
  'oppervlakteBvo',
  'oppervlakteGbo',
  'bouwjaar',
  'marktwaardeIndicatie',
];

function isEmptyWrite(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function hasStoredValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function guardObjectPatch(
  patch: GuardedObjectPatch,
  current?: ObjectVastgoed,
  onBlocked?: (field: keyof ObjectVastgoed) => void,
): Partial<ObjectVastgoed> {
  const allowClear = new Set(patch[OBJECT_CLEAR_GUARD_META] ?? []);
  const clean = stripUndefinedEntries(patch as Record<string, unknown>) as Partial<ObjectVastgoed>;

  for (const field of PROTECTED_OBJECT_FIELDS) {
    if (!(field in clean)) continue;
    if (!isEmptyWrite(clean[field])) continue;
    if (allowClear.has(field)) continue;
    if (current && !hasStoredValue(current[field])) continue;
    delete clean[field];
    onBlocked?.(field);
  }

  return clean;
}
