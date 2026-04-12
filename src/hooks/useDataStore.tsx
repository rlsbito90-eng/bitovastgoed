import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  relaties as initialRelaties,
  objecten as initialObjecten,
  deals as initialDeals,
  taken as initialTaken,
  zoekprofielen as initialZoekprofielen,
  type Relatie,
  type ObjectVastgoed,
  type Deal,
  type Taak,
  type Zoekprofiel,
} from '@/data/mock-data';

interface DataStore {
  relaties: Relatie[];
  objecten: ObjectVastgoed[];
  deals: Deal[];
  taken: Taak[];
  zoekprofielen: Zoekprofiel[];
  addRelatie: (r: Omit<Relatie, 'id'>) => Relatie;
  updateRelatie: (id: string, r: Partial<Relatie>) => void;
  deleteRelatie: (id: string) => void;
  addObject: (o: Omit<ObjectVastgoed, 'id'>) => ObjectVastgoed;
  updateObject: (id: string, o: Partial<ObjectVastgoed>) => void;
  deleteObject: (id: string) => void;
  addDeal: (d: Omit<Deal, 'id'>) => Deal;
  updateDeal: (id: string, d: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  addTaak: (t: Omit<Taak, 'id'>) => Taak;
  updateTaak: (id: string, t: Partial<Taak>) => void;
  deleteTaak: (id: string) => void;
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

let counter = 100;
const genId = (prefix: string) => `${prefix}-${++counter}`;

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const [relaties, setRelaties] = useState<Relatie[]>(initialRelaties);
  const [objecten, setObjecten] = useState<ObjectVastgoed[]>(initialObjecten);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [taken, setTaken] = useState<Taak[]>(initialTaken);
  const [zoekprofielen] = useState<Zoekprofiel[]>(initialZoekprofielen);

  const addRelatie = useCallback((r: Omit<Relatie, 'id'>) => {
    const newR = { ...r, id: genId('rel') } as Relatie;
    setRelaties(prev => [...prev, newR]);
    return newR;
  }, []);
  const updateRelatie = useCallback((id: string, r: Partial<Relatie>) => {
    setRelaties(prev => prev.map(x => x.id === id ? { ...x, ...r } : x));
  }, []);
  const deleteRelatie = useCallback((id: string) => {
    setRelaties(prev => prev.filter(x => x.id !== id));
  }, []);

  const addObject = useCallback((o: Omit<ObjectVastgoed, 'id'>) => {
    const newO = { ...o, id: genId('obj') } as ObjectVastgoed;
    setObjecten(prev => [...prev, newO]);
    return newO;
  }, []);
  const updateObject = useCallback((id: string, o: Partial<ObjectVastgoed>) => {
    setObjecten(prev => prev.map(x => x.id === id ? { ...x, ...o } : x));
  }, []);
  const deleteObject = useCallback((id: string) => {
    setObjecten(prev => prev.filter(x => x.id !== id));
  }, []);

  const addDeal = useCallback((d: Omit<Deal, 'id'>) => {
    const newD = { ...d, id: genId('deal') } as Deal;
    setDeals(prev => [...prev, newD]);
    return newD;
  }, []);
  const updateDeal = useCallback((id: string, d: Partial<Deal>) => {
    setDeals(prev => prev.map(x => x.id === id ? { ...x, ...d } : x));
  }, []);
  const deleteDeal = useCallback((id: string) => {
    setDeals(prev => prev.filter(x => x.id !== id));
  }, []);

  const addTaak = useCallback((t: Omit<Taak, 'id'>) => {
    const newT = { ...t, id: genId('taak') } as Taak;
    setTaken(prev => [...prev, newT]);
    return newT;
  }, []);
  const updateTaak = useCallback((id: string, t: Partial<Taak>) => {
    setTaken(prev => prev.map(x => x.id === id ? { ...x, ...t } : x));
  }, []);
  const deleteTaak = useCallback((id: string) => {
    setTaken(prev => prev.filter(x => x.id !== id));
  }, []);

  const store: DataStore = {
    relaties,
    objecten,
    deals,
    taken,
    zoekprofielen,
    addRelatie, updateRelatie, deleteRelatie,
    addObject, updateObject, deleteObject,
    addDeal, updateDeal, deleteDeal,
    addTaak, updateTaak, deleteTaak,
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
