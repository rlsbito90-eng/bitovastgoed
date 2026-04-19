import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  Relatie,
  ObjectVastgoed,
  Deal,
  Taak,
  Zoekprofiel,
  DealObjectKoppeling,
  DealKandidaat,
  KandidaatStatus,
} from '@/data/mock-data';

// =====================================================
// MAPPERS — DB (snake_case) <-> App (camelCase)
// =====================================================

const relatieFromDb = (r: any): Relatie => ({
  id: r.id,
  bedrijfsnaam: r.bedrijfsnaam ?? '',
  contactpersoon: r.contactpersoon ?? '',
  type: r.type_partij ?? 'belegger',
  telefoon: r.telefoon ?? '',
  email: r.email ?? '',
  regio: r.regio ?? [],
  assetClasses: r.asset_classes ?? [],
  budgetMin: r.budget_min ?? undefined,
  budgetMax: r.budget_max ?? undefined,
  aankoopcriteria: r.aankoopcriteria ?? undefined,
  verkoopintentie: r.verkoopintentie ?? undefined,
  leadStatus: r.lead_status ?? 'lauw',
  laatsteContact: r.laatste_contactdatum ?? '',
  volgendeActie: r.volgende_actie ?? undefined,
  notities: r.notities ?? undefined,
});

// Helper: alleen niet-undefined velden meesturen, zodat partial updates niet andere
// velden per ongeluk overschrijven met null.
const cleanPayload = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const out: any = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
};

const relatieToDb = (r: Partial<Relatie>) => cleanPayload({
  bedrijfsnaam: r.bedrijfsnaam !== undefined ? (r.bedrijfsnaam || 'Onbekend') : undefined,
  contactpersoon: r.contactpersoon !== undefined ? (r.contactpersoon || null) : undefined,
  type_partij: r.type,
  telefoon: r.telefoon !== undefined ? (r.telefoon || null) : undefined,
  email: r.email !== undefined ? (r.email || null) : undefined,
  regio: r.regio,
  asset_classes: r.assetClasses,
  budget_min: r.budgetMin ?? null,
  budget_max: r.budgetMax ?? null,
  aankoopcriteria: r.aankoopcriteria !== undefined ? (r.aankoopcriteria || null) : undefined,
  verkoopintentie: r.verkoopintentie !== undefined ? (r.verkoopintentie || null) : undefined,
  lead_status: r.leadStatus,
  laatste_contactdatum: r.laatsteContact !== undefined ? (r.laatsteContact || null) : undefined,
  volgende_actie: r.volgendeActie !== undefined ? (r.volgendeActie || null) : undefined,
  notities: r.notities !== undefined ? (r.notities || null) : undefined,
});

const objectFromDb = (o: any): ObjectVastgoed => ({
  id: o.id,
  titel: o.objectnaam ?? '',
  plaats: o.plaats ?? '',
  provincie: o.provincie ?? '',
  type: o.type_vastgoed,
  vraagprijs: o.vraagprijs ?? undefined,
  huurinkomsten: o.huurinkomsten ?? undefined,
  aantalHuurders: o.aantal_huurders ?? undefined,
  verhuurStatus: o.verhuurstatus ?? 'leeg',
  oppervlakte: o.oppervlakte ?? undefined,
  bouwjaar: o.bouwjaar ?? undefined,
  onderhoudsstaat: o.onderhoudsstaat ?? undefined,
  ontwikkelPotentie: !!o.ontwikkelpotentie,
  transformatiePotentie: !!o.transformatiepotentie,
  bron: o.bron ?? undefined,
  exclusief: !!o.exclusief,
  status: mapDbObjectStatusNaarApp(o.status),
  samenvatting: o.samenvatting ?? undefined,
  documentenBeschikbaar: !!o.documentatie_beschikbaar,
  interneOpmerkingen: o.interne_opmerkingen ?? undefined,
  datumToegevoegd: o.created_at?.split('T')[0] ?? '',
  internReferentienummer: o.intern_referentienummer ?? undefined,
  adres: o.adres ?? undefined,
  postcode: o.postcode ?? undefined,
  subcategorie: o.subcategorie ?? undefined,
  prijsindicatie: o.prijsindicatie ?? undefined,
  huurPerM2: o.huur_per_m2 ?? undefined,
  brutoAanvangsrendement: o.bruto_aanvangsrendement ?? undefined,
  leegstandPct: o.leegstand_pct ?? undefined,
  oppervlakteVvo: o.oppervlakte_vvo ?? undefined,
  oppervlakteBvo: o.oppervlakte_bvo ?? undefined,
  perceelOppervlakte: o.perceel_oppervlakte ?? undefined,
  energielabel: o.energielabel ?? undefined,
  eigendomssituatie: o.eigendomssituatie ?? undefined,
  erfpachtinformatie: o.erfpachtinformatie ?? undefined,
  bestemmingsinformatie: o.bestemmingsinformatie ?? undefined,
  beschikbaarVanaf: o.beschikbaar_vanaf ?? undefined,
  opmerkingen: o.opmerkingen ?? undefined,
});

const objectToDb = (o: Partial<ObjectVastgoed>) => cleanPayload({
  objectnaam: o.titel !== undefined ? (o.titel || 'Onbekend object') : undefined,
  plaats: o.plaats !== undefined ? (o.plaats || null) : undefined,
  provincie: o.provincie !== undefined ? (o.provincie || null) : undefined,
  type_vastgoed: o.type,
  vraagprijs: o.vraagprijs ?? null,
  huurinkomsten: o.huurinkomsten ?? null,
  aantal_huurders: o.aantalHuurders ?? null,
  verhuurstatus: o.verhuurStatus,
  oppervlakte: o.oppervlakte ?? null,
  bouwjaar: o.bouwjaar ?? null,
  onderhoudsstaat: o.onderhoudsstaat !== undefined ? (o.onderhoudsstaat || null) : undefined,
  ontwikkelpotentie: o.ontwikkelPotentie,
  transformatiepotentie: o.transformatiePotentie,
  bron: o.bron !== undefined ? (o.bron || null) : undefined,
  exclusief: o.exclusief,
  status: o.status !== undefined ? mapAppObjectStatusNaarDb(o.status) : undefined,
  samenvatting: o.samenvatting !== undefined ? (o.samenvatting || null) : undefined,
  documentatie_beschikbaar: o.documentenBeschikbaar,
  interne_opmerkingen: o.interneOpmerkingen !== undefined ? (o.interneOpmerkingen || null) : undefined,
  intern_referentienummer: o.internReferentienummer !== undefined ? (o.internReferentienummer || null) : undefined,
  adres: o.adres !== undefined ? (o.adres || null) : undefined,
  postcode: o.postcode !== undefined ? (o.postcode || null) : undefined,
  subcategorie: o.subcategorie !== undefined ? (o.subcategorie || null) : undefined,
  prijsindicatie: o.prijsindicatie !== undefined ? (o.prijsindicatie || null) : undefined,
  huur_per_m2: o.huurPerM2 ?? null,
  bruto_aanvangsrendement: o.brutoAanvangsrendement ?? null,
  leegstand_pct: o.leegstandPct ?? null,
  oppervlakte_vvo: o.oppervlakteVvo ?? null,
  oppervlakte_bvo: o.oppervlakteBvo ?? null,
  perceel_oppervlakte: o.perceelOppervlakte ?? null,
  energielabel: o.energielabel !== undefined ? (o.energielabel || null) : undefined,
  eigendomssituatie: o.eigendomssituatie !== undefined ? (o.eigendomssituatie || null) : undefined,
  erfpachtinformatie: o.erfpachtinformatie !== undefined ? (o.erfpachtinformatie || null) : undefined,
  bestemmingsinformatie: o.bestemmingsinformatie !== undefined ? (o.bestemmingsinformatie || null) : undefined,
  beschikbaar_vanaf: o.beschikbaarVanaf !== undefined ? (o.beschikbaarVanaf || null) : undefined,
  opmerkingen: o.opmerkingen !== undefined ? (o.opmerkingen || null) : undefined,
});

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

const dealFromDb = (d: any): Deal => ({
  id: d.id,
  objectId: d.object_id,
  relatieId: d.relatie_id,
  fase: d.fase,
  interessegraad: d.interessegraad ?? 3,
  datumEersteContact: d.datum_eerste_contact,
  datumFollowUp: d.datum_follow_up ?? undefined,
  bezichtigingGepland: d.bezichtiging_gepland ?? undefined,
  indicatiefBod: d.indicatief_bod ?? undefined,
  notities: d.notities ?? undefined,
});

const dealToDb = (d: Partial<Deal>) => cleanPayload({
  object_id: d.objectId,
  relatie_id: d.relatieId,
  fase: d.fase,
  interessegraad: d.interessegraad ?? null,
  datum_eerste_contact: d.datumEersteContact,
  datum_follow_up: d.datumFollowUp !== undefined ? (d.datumFollowUp || null) : undefined,
  bezichtiging_gepland: d.bezichtigingGepland !== undefined ? (d.bezichtigingGepland || null) : undefined,
  indicatief_bod: d.indicatiefBod ?? null,
  notities: d.notities !== undefined ? (d.notities || null) : undefined,
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
  regio: z.regio ?? [],
  stad: z.steden?.[0] ?? undefined,
  prijsMin: z.prijs_min ?? undefined,
  prijsMax: z.prijs_max ?? undefined,
  oppervlakteMin: z.oppervlakte_min ?? undefined,
  oppervlakteMax: z.oppervlakte_max ?? undefined,
  verhuurStatus: z.verhuur_voorkeur ?? undefined,
  rendementseis: z.rendementseis ?? undefined,
  ontwikkelPotentie: !!z.ontwikkelpotentie,
  transformatiePotentie: !!z.transformatiepotentie,
  aanvullendeCriteria: z.aanvullende_criteria ?? undefined,
  status: z.status === 'gepauzeerd' ? 'pauze' : z.status,
});

const zoekprofielToDb = (z: Partial<Zoekprofiel>) => cleanPayload({
  profielnaam: z.naam !== undefined ? (z.naam || 'Naamloos zoekprofiel') : undefined,
  relatie_id: z.relatieId,
  type_vastgoed: z.typeVastgoed,
  regio: z.regio,
  steden: z.stad !== undefined ? (z.stad ? [z.stad] : []) : undefined,
  prijs_min: z.prijsMin ?? null,
  prijs_max: z.prijsMax ?? null,
  oppervlakte_min: z.oppervlakteMin ?? null,
  oppervlakte_max: z.oppervlakteMax ?? null,
  verhuur_voorkeur: z.verhuurStatus ?? null,
  rendementseis: z.rendementseis ?? null,
  ontwikkelpotentie: z.ontwikkelPotentie,
  transformatiepotentie: z.transformatiePotentie,
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

// =====================================================
// CONTEXT
// =====================================================

interface DataStore {
  relaties: Relatie[];
  objecten: ObjectVastgoed[];
  deals: Deal[];
  taken: Taak[];
  zoekprofielen: Zoekprofiel[];
  dealObjecten: DealObjectKoppeling[];
  dealKandidaten: DealKandidaat[];
  loading: boolean;
  refresh: () => Promise<void>;

  addRelatie: (r: Omit<Relatie, 'id'>) => Promise<Relatie | null>;
  updateRelatie: (id: string, r: Partial<Relatie>) => Promise<void>;
  deleteRelatie: (id: string) => Promise<void>;
  bulkInsertRelaties: (rows: Partial<Relatie>[]) => Promise<{ ok: number; fout: number }>;

  addObject: (o: Omit<ObjectVastgoed, 'id'>) => Promise<ObjectVastgoed | null>;
  updateObject: (id: string, o: Partial<ObjectVastgoed>) => Promise<void>;
  deleteObject: (id: string) => Promise<void>;

  addDeal: (d: Omit<Deal, 'id'>) => Promise<Deal | null>;
  updateDeal: (id: string, d: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;

  addTaak: (t: Omit<Taak, 'id'>) => Promise<Taak | null>;
  updateTaak: (id: string, t: Partial<Taak>) => Promise<void>;
  deleteTaak: (id: string) => Promise<void>;

  addZoekprofiel: (z: Omit<Zoekprofiel, 'id'>) => Promise<Zoekprofiel | null>;
  updateZoekprofiel: (id: string, z: Partial<Zoekprofiel>) => Promise<void>;
  deleteZoekprofiel: (id: string) => Promise<void>;

  // Deal-objecten
  addDealObject: (dealId: string, objectId: string, isPrimair?: boolean) => Promise<void>;
  removeDealObject: (id: string) => Promise<void>;
  setPrimairDealObject: (dealId: string, koppelingId: string) => Promise<void>;
  getObjectenVoorDeal: (dealId: string) => DealObjectKoppeling[];

  // Deal-kandidaten
  addDealKandidaat: (dealId: string, relatieId: string, status?: KandidaatStatus) => Promise<void>;
  updateDealKandidaat: (id: string, patch: { status?: KandidaatStatus; notities?: string }) => Promise<void>;
  removeDealKandidaat: (id: string) => Promise<void>;
  getKandidatenVoorDeal: (dealId: string) => DealKandidaat[];

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

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const { heeftToegang } = useAuth();
  const [relaties, setRelaties] = useState<Relatie[]>([]);
  const [objecten, setObjecten] = useState<ObjectVastgoed[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [taken, setTaken] = useState<Taak[]>([]);
  const [zoekprofielen, setZoekprofielen] = useState<Zoekprofiel[]>([]);
  const [dealObjecten, setDealObjecten] = useState<DealObjectKoppeling[]>([]);
  const [dealKandidaten, setDealKandidaten] = useState<DealKandidaat[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!heeftToegang) return;
    setLoading(true);
    const [relRes, objRes, dealRes, taakRes, zpRes, doRes, dkRes] = await Promise.all([
      supabase.from('relaties').select('*').order('created_at', { ascending: false }),
      supabase.from('objecten').select('*').order('created_at', { ascending: false }),
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
      supabase.from('taken').select('*').order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('zoekprofielen').select('*').order('created_at', { ascending: false }),
      supabase.from('deal_objecten' as any).select('*'),
      supabase.from('deal_kandidaten' as any).select('*'),
    ]);
    if (relRes.data) setRelaties(relRes.data.map(relatieFromDb));
    if (objRes.data) setObjecten(objRes.data.map(objectFromDb));
    if (dealRes.data) setDeals(dealRes.data.map(dealFromDb));
    if (taakRes.data) setTaken(taakRes.data.map(taakFromDb));
    if (zpRes.data) setZoekprofielen(zpRes.data.map(zoekprofielFromDb));
    if (doRes.data) setDealObjecten((doRes.data as any[]).map(dealObjectFromDb));
    if (dkRes.data) setDealKandidaten((dkRes.data as any[]).map(dealKandidaatFromDb));
    setLoading(false);
  }, [heeftToegang]);

  useEffect(() => {
    if (heeftToegang) refresh();
  }, [heeftToegang, refresh]);

  const throwIfError = (error: any) => {
    if (error) {
      console.warn('Databasebewerking mislukt');
      throw new Error('De bewerking kon niet worden voltooid. Probeer het opnieuw.');
    }
  };

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
    const upd = relatieFromDb(data);
    setRelaties(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteRelatie = useCallback(async (id: string) => {
    const { error } = await supabase.from('relaties').delete().eq('id', id);
    throwIfError(error);
    setRelaties(prev => prev.filter(x => x.id !== id));
    setDeals(prev => prev.filter(d => d.relatieId !== id));
  }, []);

  const bulkInsertRelaties = useCallback(async (rows: Partial<Relatie>[]) => {
    if (rows.length === 0) return { ok: 0, fout: 0 };
    const payload = rows.map(r => relatieToDb({
      leadStatus: 'lauw',
      type: 'belegger',
      regio: [],
      assetClasses: [],
      ...r,
    }) as any);
    const { data, error } = await supabase.from('relaties').insert(payload).select();
    if (error) {
      console.warn('Bulk insert mislukt');
      throw new Error('Bulk import mislukt. Controleer de invoer.');
    }
    const nieuwe = (data ?? []).map(relatieFromDb);
    setRelaties(prev => [...nieuwe, ...prev]);
    return { ok: nieuwe.length, fout: rows.length - nieuwe.length };
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
    const upd = objectFromDb(data);
    setObjecten(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteObject = useCallback(async (id: string) => {
    const { error } = await supabase.from('objecten').delete().eq('id', id);
    throwIfError(error);
    setObjecten(prev => prev.filter(x => x.id !== id));
    setDeals(prev => prev.filter(d => d.objectId !== id));
  }, []);

  // -------- DEALS --------
  const addDeal = useCallback(async (d: Omit<Deal, 'id'>) => {
    const { data, error } = await supabase.from('deals').insert(dealToDb(d) as any).select().single();
    throwIfError(error);
    const nieuw = dealFromDb(data);
    setDeals(prev => [nieuw, ...prev]);
    // Spiegel ook in koppeltabellen voor consistentie
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
    const upd = dealFromDb(data);
    setDeals(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
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
    const upd = taakFromDb(data);
    setTaken(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteTaak = useCallback(async (id: string) => {
    const { error } = await supabase.from('taken').delete().eq('id', id);
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
    const upd = zoekprofielFromDb(data);
    setZoekprofielen(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteZoekprofiel = useCallback(async (id: string) => {
    const { error } = await supabase.from('zoekprofielen').delete().eq('id', id);
    throwIfError(error);
    setZoekprofielen(prev => prev.filter(x => x.id !== id));
  }, []);

  // -------- DEAL OBJECTEN --------
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
    // Reset alle koppelingen voor deze deal, zet 1 op true
    const { error: e1 } = await supabase.from('deal_objecten' as any).update({ is_primair: false } as any).eq('deal_id', dealId);
    throwIfError(e1);
    const { error: e2 } = await supabase.from('deal_objecten' as any).update({ is_primair: true } as any).eq('id', koppelingId);
    throwIfError(e2);
    // Sync ook de legacy deals.object_id
    const koppeling = dealObjecten.find(x => x.id === koppelingId);
    if (koppeling) {
      await supabase.from('deals').update({ object_id: koppeling.objectId }).eq('id', dealId);
    }
    await refresh();
  }, [dealObjecten, refresh]);

  const getObjectenVoorDeal = useCallback((dealId: string) =>
    dealObjecten.filter(x => x.dealId === dealId), [dealObjecten]);

  // -------- DEAL KANDIDATEN --------
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

  const getKandidatenVoorDeal = useCallback((dealId: string) =>
    dealKandidaten.filter(x => x.dealId === dealId), [dealKandidaten]);

  const store: DataStore = {
    relaties, objecten, deals, taken, zoekprofielen, dealObjecten, dealKandidaten, loading, refresh,
    addRelatie, updateRelatie, deleteRelatie, bulkInsertRelaties,
    addObject, updateObject, deleteObject,
    addDeal, updateDeal, deleteDeal,
    addTaak, updateTaak, deleteTaak,
    addZoekprofiel, updateZoekprofiel, deleteZoekprofiel,
    addDealObject, removeDealObject, setPrimairDealObject, getObjectenVoorDeal,
    addDealKandidaat, updateDealKandidaat, removeDealKandidaat, getKandidatenVoorDeal,
    getRelatieById: (id) => relaties.find(r => r.id === id),
    getObjectById: (id) => objecten.find(o => o.id === id),
    getDealById: (id) => deals.find(d => d.id === id),
    getDealsByRelatie: (rid) => {
      // Een deal hoort bij een relatie via de primaire relatieId OF via deal_kandidaten
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
