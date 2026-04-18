import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  Relatie,
  ObjectVastgoed,
  Deal,
  Taak,
  Zoekprofiel,
} from '@/data/mock-data';

// =====================================================
// MAPPERS — DB (snake_case) <-> App (camelCase)
// We bewaren bestaande type-API zodat pagina's niets hoeven te veranderen.
// =====================================================

const relatieFromDb = (r: any): Relatie => ({
  id: r.id,
  bedrijfsnaam: r.bedrijfsnaam,
  contactpersoon: r.contactpersoon ?? '',
  type: r.type_partij,
  telefoon: r.telefoon ?? '',
  email: r.email ?? '',
  regio: r.regio ?? [],
  assetClasses: r.asset_classes ?? [],
  budgetMin: r.budget_min ?? undefined,
  budgetMax: r.budget_max ?? undefined,
  aankoopcriteria: r.aankoopcriteria ?? undefined,
  verkoopintentie: r.verkoopintentie ?? undefined,
  leadStatus: r.lead_status,
  laatsteContact: r.laatste_contactdatum ?? '',
  volgendeActie: r.volgende_actie ?? undefined,
  notities: r.notities ?? undefined,
});

const relatieToDb = (r: Partial<Relatie>) => ({
  bedrijfsnaam: r.bedrijfsnaam,
  contactpersoon: r.contactpersoon || null,
  type_partij: r.type,
  telefoon: r.telefoon || null,
  email: r.email || null,
  regio: r.regio ?? [],
  asset_classes: r.assetClasses ?? [],
  budget_min: r.budgetMin ?? null,
  budget_max: r.budgetMax ?? null,
  aankoopcriteria: r.aankoopcriteria || null,
  verkoopintentie: r.verkoopintentie || null,
  lead_status: r.leadStatus,
  laatste_contactdatum: r.laatsteContact || null,
  volgende_actie: r.volgendeActie || null,
  notities: r.notities || null,
});

const objectFromDb = (o: any): ObjectVastgoed => ({
  id: o.id,
  titel: o.objectnaam,
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
});

const objectToDb = (o: Partial<ObjectVastgoed>) => ({
  objectnaam: o.titel,
  plaats: o.plaats || null,
  provincie: o.provincie || null,
  type_vastgoed: o.type,
  vraagprijs: o.vraagprijs ?? null,
  huurinkomsten: o.huurinkomsten ?? null,
  aantal_huurders: o.aantalHuurders ?? null,
  verhuurstatus: o.verhuurStatus ?? null,
  oppervlakte: o.oppervlakte ?? null,
  bouwjaar: o.bouwjaar ?? null,
  onderhoudsstaat: o.onderhoudsstaat || null,
  ontwikkelpotentie: !!o.ontwikkelPotentie,
  transformatiepotentie: !!o.transformatiePotentie,
  bron: o.bron || null,
  exclusief: !!o.exclusief,
  status: mapAppObjectStatusNaarDb(o.status),
  samenvatting: o.samenvatting || null,
  documentatie_beschikbaar: !!o.documentenBeschikbaar,
  interne_opmerkingen: o.interneOpmerkingen || null,
});

// 1-op-1 mapping tussen App-statussen en DB-enum (geen verlies bij round-trip).
// App: 'off-market' | 'in_onderzoek' | 'beschikbaar' | 'onder_optie' | 'verkocht' | 'ingetrokken'
// DB:  'nieuw'      | 'in_voorbereiding' | 'beschikbaar' | 'in_onderhandeling' | 'verkocht' | 'ingetrokken'
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

const dealToDb = (d: Partial<Deal>) => ({
  object_id: d.objectId,
  relatie_id: d.relatieId,
  fase: d.fase,
  interessegraad: d.interessegraad ?? null,
  datum_eerste_contact: d.datumEersteContact,
  datum_follow_up: d.datumFollowUp || null,
  bezichtiging_gepland: d.bezichtigingGepland || null,
  indicatief_bod: d.indicatiefBod ?? null,
  notities: d.notities || null,
});

const taakFromDb = (t: any): Taak => ({
  id: t.id,
  titel: t.titel,
  relatieId: t.relatie_id ?? undefined,
  dealId: t.deal_id ?? undefined,
  type: t.type_taak ?? 'Overig',
  deadline: t.deadline ?? '',
  prioriteit: t.prioriteit,
  status: t.status,
  notities: t.notities ?? undefined,
});

const taakToDb = (t: Partial<Taak>) => ({
  titel: t.titel,
  relatie_id: t.relatieId || null,
  deal_id: t.dealId || null,
  type_taak: t.type || null,
  deadline: t.deadline || null,
  prioriteit: t.prioriteit,
  status: t.status,
  notities: t.notities || null,
});

const zoekprofielFromDb = (z: any): Zoekprofiel => ({
  id: z.id,
  naam: z.profielnaam,
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

const zoekprofielToDb = (z: Partial<Zoekprofiel>) => ({
  profielnaam: z.naam,
  relatie_id: z.relatieId,
  type_vastgoed: z.typeVastgoed ?? [],
  regio: z.regio ?? [],
  steden: z.stad ? [z.stad] : [],
  prijs_min: z.prijsMin ?? null,
  prijs_max: z.prijsMax ?? null,
  oppervlakte_min: z.oppervlakteMin ?? null,
  oppervlakte_max: z.oppervlakteMax ?? null,
  verhuur_voorkeur: z.verhuurStatus ?? null,
  rendementseis: z.rendementseis ?? null,
  ontwikkelpotentie: !!z.ontwikkelPotentie,
  transformatiepotentie: !!z.transformatiePotentie,
  aanvullende_criteria: z.aanvullendeCriteria || null,
  status: z.status === 'pauze' ? 'gepauzeerd' : (z.status ?? 'actief'),
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
  loading: boolean;
  refresh: () => Promise<void>;

  addRelatie: (r: Omit<Relatie, 'id'>) => Promise<Relatie | null>;
  updateRelatie: (id: string, r: Partial<Relatie>) => Promise<void>;
  deleteRelatie: (id: string) => Promise<void>;

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
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!heeftToegang) return;
    setLoading(true);
    const [relRes, objRes, dealRes, taakRes, zpRes] = await Promise.all([
      supabase.from('relaties').select('*').order('created_at', { ascending: false }),
      supabase.from('objecten').select('*').order('created_at', { ascending: false }),
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
      supabase.from('taken').select('*').order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('zoekprofielen').select('*').order('created_at', { ascending: false }),
    ]);
    if (relRes.data) setRelaties(relRes.data.map(relatieFromDb));
    if (objRes.data) setObjecten(objRes.data.map(objectFromDb));
    if (dealRes.data) setDeals(dealRes.data.map(dealFromDb));
    if (taakRes.data) setTaken(taakRes.data.map(taakFromDb));
    if (zpRes.data) setZoekprofielen(zpRes.data.map(zoekprofielFromDb));
    setLoading(false);
  }, [heeftToegang]);

  useEffect(() => {
    if (heeftToegang) refresh();
  }, [heeftToegang, refresh]);

  // Generieke helpers — gooien een nette Error met de DB-message zodat dialogs het kunnen tonen.
  const throwIfError = (error: any) => {
    if (error) {
      console.error('[Supabase]', error);
      throw new Error(error.message || 'Onbekende databasefout');
    }
  };

  // -------- RELATIES --------
  const addRelatie = useCallback(async (r: Omit<Relatie, 'id'>) => {
    const { data, error } = await supabase
      .from('relaties')
      .insert(relatieToDb(r) as any)
      .select()
      .single();
    throwIfError(error);
    const nieuw = relatieFromDb(data);
    setRelaties(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateRelatie = useCallback(async (id: string, r: Partial<Relatie>) => {
    const { data, error } = await supabase
      .from('relaties')
      .update(relatieToDb(r) as any)
      .eq('id', id)
      .select()
      .single();
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

  // -------- OBJECTEN --------
  const addObject = useCallback(async (o: Omit<ObjectVastgoed, 'id'>) => {
    const { data, error } = await supabase
      .from('objecten')
      .insert(objectToDb(o) as any)
      .select()
      .single();
    throwIfError(error);
    const nieuw = objectFromDb(data);
    setObjecten(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateObject = useCallback(async (id: string, o: Partial<ObjectVastgoed>) => {
    const { data, error } = await supabase
      .from('objecten')
      .update(objectToDb(o) as any)
      .eq('id', id)
      .select()
      .single();
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
    const { data, error } = await supabase
      .from('deals')
      .insert(dealToDb(d) as any)
      .select()
      .single();
    throwIfError(error);
    const nieuw = dealFromDb(data);
    setDeals(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateDeal = useCallback(async (id: string, d: Partial<Deal>) => {
    const { data, error } = await supabase
      .from('deals')
      .update(dealToDb(d) as any)
      .eq('id', id)
      .select()
      .single();
    throwIfError(error);
    const upd = dealFromDb(data);
    setDeals(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    throwIfError(error);
    setDeals(prev => prev.filter(x => x.id !== id));
  }, []);

  // -------- TAKEN --------
  const addTaak = useCallback(async (t: Omit<Taak, 'id'>) => {
    const { data, error } = await supabase
      .from('taken')
      .insert(taakToDb(t) as any)
      .select()
      .single();
    throwIfError(error);
    const nieuw = taakFromDb(data);
    setTaken(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateTaak = useCallback(async (id: string, t: Partial<Taak>) => {
    const { data, error } = await supabase
      .from('taken')
      .update(taakToDb(t) as any)
      .eq('id', id)
      .select()
      .single();
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
    const { data, error } = await supabase
      .from('zoekprofielen')
      .insert(zoekprofielToDb(z) as any)
      .select()
      .single();
    throwIfError(error);
    const nieuw = zoekprofielFromDb(data);
    setZoekprofielen(prev => [nieuw, ...prev]);
    return nieuw;
  }, []);

  const updateZoekprofiel = useCallback(async (id: string, z: Partial<Zoekprofiel>) => {
    const { data, error } = await supabase
      .from('zoekprofielen')
      .update(zoekprofielToDb(z) as any)
      .eq('id', id)
      .select()
      .single();
    throwIfError(error);
    const upd = zoekprofielFromDb(data);
    setZoekprofielen(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteZoekprofiel = useCallback(async (id: string) => {
    const { error } = await supabase.from('zoekprofielen').delete().eq('id', id);
    throwIfError(error);
    setZoekprofielen(prev => prev.filter(x => x.id !== id));
  }, []);

  const store: DataStore = {
    relaties, objecten, deals, taken, zoekprofielen, loading, refresh,
    addRelatie, updateRelatie, deleteRelatie,
    addObject, updateObject, deleteObject,
    addDeal, updateDeal, deleteDeal,
    addTaak, updateTaak, deleteTaak,
    addZoekprofiel, updateZoekprofiel, deleteZoekprofiel,
    getRelatieById: (id) => relaties.find(r => r.id === id),
    getObjectById: (id) => objecten.find(o => o.id === id),
    getDealById: (id) => deals.find(d => d.id === id),
    getDealsByRelatie: (rid) => deals.filter(d => d.relatieId === rid),
    getDealsByObject: (oid) => deals.filter(d => d.objectId === oid),
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
