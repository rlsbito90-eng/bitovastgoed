// src/hooks/useAcquisitie.tsx
// Stand-alone provider voor de Acquisitie-module. Bewust losgekoppeld
// van useDataStore zodat bestaande modules niet geraakt worden.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  AcquisitieCampagne,
  AcquisitieTarget,
  AcquisitieStatus,
  CampagneKanaal,
  CampagneStatus,
  EigenaarBekend,
} from '@/lib/acquisitie';

// We typen Supabase resultaten lokaal met `any` zodat we niet de auto-generated
// types hoeven aan te passen. RLS staat enkel intern lezen/schrijven toe.
const sb = supabase as any;

const targetFromDb = (r: any): AcquisitieTarget => ({
  id: r.id,
  adres: r.adres,
  postcode: r.postcode,
  plaats: r.plaats,
  wijk: r.wijk,
  typeVastgoed: r.type_vastgoed,
  redenInteressant: r.reden_interessant,
  bron: r.bron,
  campagneId: r.campagne_id,
  eigenaarBekend: r.eigenaar_bekend,
  eigenaarWoontOpAdres: r.eigenaar_woont_op_adres,
  relatieId: r.relatie_id,
  status: r.status,
  prioriteit: r.prioriteit ?? 3,
  laatsteActieDatum: r.laatste_actie_datum,
  volgendeActieDatum: r.volgende_actie_datum,
  volgendeActieOmschrijving: r.volgende_actie_omschrijving,
  notities: r.notities,
  objectId: r.object_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const campagneFromDb = (r: any): AcquisitieCampagne => ({
  id: r.id,
  naam: r.naam,
  kanaal: r.kanaal,
  gebied: r.gebied,
  startdatum: r.startdatum,
  status: r.status,
  notities: r.notities,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface NieuweTarget {
  adres?: string;
  postcode?: string;
  plaats?: string;
  wijk?: string;
  typeVastgoed?: string;
  redenInteressant?: string;
  bron?: string;
  campagneId?: string | null;
  eigenaarBekend?: EigenaarBekend;
  eigenaarWoontOpAdres?: EigenaarBekend;
  relatieId?: string | null;
  status?: AcquisitieStatus;
  prioriteit?: number;
  laatsteActieDatum?: string | null;
  volgendeActieDatum?: string | null;
  volgendeActieOmschrijving?: string;
  notities?: string;
}

export interface NieuweCampagne {
  naam: string;
  kanaal: CampagneKanaal;
  gebied?: string;
  startdatum?: string | null;
  status?: CampagneStatus;
  notities?: string;
}

interface Ctx {
  targets: AcquisitieTarget[];
  campagnes: AcquisitieCampagne[];
  laden: boolean;
  refresh: () => Promise<void>;
  addTarget: (t: NieuweTarget) => Promise<AcquisitieTarget>;
  updateTarget: (id: string, t: Partial<NieuweTarget> & { objectId?: string | null }) => Promise<void>;
  deleteTarget: (id: string) => Promise<void>;
  addCampagne: (c: NieuweCampagne) => Promise<AcquisitieCampagne>;
  updateCampagne: (id: string, c: Partial<NieuweCampagne>) => Promise<void>;
  deleteCampagne: (id: string) => Promise<void>;
  /** Maak een Object aan vanuit een target en update target naar 'object_aangemaakt'. */
  converteerNaarObject: (targetId: string) => Promise<{ objectId: string }>;
}

const AcquisitieContext = createContext<Ctx | undefined>(undefined);

const camelNaarSnakeTarget = (t: Partial<NieuweTarget> & { objectId?: string | null }): Record<string, any> => {
  const out: Record<string, any> = {};
  if (t.adres !== undefined) out.adres = t.adres || null;
  if (t.postcode !== undefined) out.postcode = t.postcode || null;
  if (t.plaats !== undefined) out.plaats = t.plaats || null;
  if (t.wijk !== undefined) out.wijk = t.wijk || null;
  if (t.typeVastgoed !== undefined) out.type_vastgoed = t.typeVastgoed || null;
  if (t.redenInteressant !== undefined) out.reden_interessant = t.redenInteressant || null;
  if (t.bron !== undefined) out.bron = t.bron || null;
  if (t.campagneId !== undefined) out.campagne_id = t.campagneId || null;
  if (t.eigenaarBekend !== undefined) out.eigenaar_bekend = t.eigenaarBekend;
  if (t.eigenaarWoontOpAdres !== undefined) out.eigenaar_woont_op_adres = t.eigenaarWoontOpAdres;
  if (t.relatieId !== undefined) out.relatie_id = t.relatieId || null;
  if (t.status !== undefined) out.status = t.status;
  if (t.prioriteit !== undefined) out.prioriteit = t.prioriteit;
  if (t.laatsteActieDatum !== undefined) out.laatste_actie_datum = t.laatsteActieDatum || null;
  if (t.volgendeActieDatum !== undefined) out.volgende_actie_datum = t.volgendeActieDatum || null;
  if (t.volgendeActieOmschrijving !== undefined) out.volgende_actie_omschrijving = t.volgendeActieOmschrijving || null;
  if (t.notities !== undefined) out.notities = t.notities || null;
  if (t.objectId !== undefined) out.object_id = t.objectId || null;
  return out;
};

const camelNaarSnakeCampagne = (c: Partial<NieuweCampagne>): Record<string, any> => {
  const out: Record<string, any> = {};
  if (c.naam !== undefined) out.naam = c.naam;
  if (c.kanaal !== undefined) out.kanaal = c.kanaal;
  if (c.gebied !== undefined) out.gebied = c.gebied || null;
  if (c.startdatum !== undefined) out.startdatum = c.startdatum || null;
  if (c.status !== undefined) out.status = c.status;
  if (c.notities !== undefined) out.notities = c.notities || null;
  return out;
};

const throwIf = (error: any) => {
  if (error) {
    console.error('Acquisitie DB-fout:', error);
    throw new Error(error.message || 'Bewerking mislukt.');
  }
};

export function AcquisitieProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [targets, setTargets] = useState<AcquisitieTarget[]>([]);
  const [campagnes, setCampagnes] = useState<AcquisitieCampagne[]>([]);
  const [laden, setLaden] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setTargets([]); setCampagnes([]); return;
    }
    setLaden(true);
    try {
      const [tRes, cRes] = await Promise.all([
        sb.from('acquisitie_targets').select('*').order('updated_at', { ascending: false }),
        sb.from('acquisitie_campagnes').select('*').order('created_at', { ascending: false }),
      ]);
      throwIf(tRes.error); throwIf(cRes.error);
      setTargets((tRes.data ?? []).map(targetFromDb));
      setCampagnes((cRes.data ?? []).map(campagneFromDb));
    } finally {
      setLaden(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addTarget = useCallback(async (t: NieuweTarget) => {
    const payload = { ...camelNaarSnakeTarget(t), aangemaakt_door: user?.id ?? null };
    const { data, error } = await sb.from('acquisitie_targets').insert(payload).select().single();
    throwIf(error);
    const nieuw = targetFromDb(data);
    setTargets(prev => [nieuw, ...prev]);
    return nieuw;
  }, [user]);

  const updateTarget = useCallback(async (id: string, t: Partial<NieuweTarget> & { objectId?: string | null }) => {
    const { data, error } = await sb.from('acquisitie_targets').update(camelNaarSnakeTarget(t)).eq('id', id).select().single();
    throwIf(error);
    const upd = targetFromDb(data);
    setTargets(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteTarget = useCallback(async (id: string) => {
    const { error } = await sb.from('acquisitie_targets').delete().eq('id', id);
    throwIf(error);
    setTargets(prev => prev.filter(x => x.id !== id));
  }, []);

  const addCampagne = useCallback(async (c: NieuweCampagne) => {
    const payload = { ...camelNaarSnakeCampagne(c), aangemaakt_door: user?.id ?? null };
    const { data, error } = await sb.from('acquisitie_campagnes').insert(payload).select().single();
    throwIf(error);
    const nieuw = campagneFromDb(data);
    setCampagnes(prev => [nieuw, ...prev]);
    return nieuw;
  }, [user]);

  const updateCampagne = useCallback(async (id: string, c: Partial<NieuweCampagne>) => {
    const { data, error } = await sb.from('acquisitie_campagnes').update(camelNaarSnakeCampagne(c)).eq('id', id).select().single();
    throwIf(error);
    const upd = campagneFromDb(data);
    setCampagnes(prev => prev.map(x => x.id === id ? upd : x));
  }, []);

  const deleteCampagne = useCallback(async (id: string) => {
    const { error } = await sb.from('acquisitie_campagnes').delete().eq('id', id);
    throwIf(error);
    setCampagnes(prev => prev.filter(x => x.id !== id));
  }, []);

  const converteerNaarObject = useCallback(async (targetId: string) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) throw new Error('Target niet gevonden.');
    const objectnaam = target.adres
      ? `${target.adres}${target.plaats ? ', ' + target.plaats : ''}`
      : `Acquisitie ${new Date().toLocaleDateString('nl-NL')}`;
    const objectPayload: Record<string, any> = {
      objectnaam,
      adres: target.adres,
      postcode: target.postcode,
      plaats: target.plaats,
      type_vastgoed: 'wonen', // legacy enum default; gebruiker kan aanpassen op detailpagina
      status: 'nieuw',
      aangemaakt_door: user?.id ?? null,
      acquisitie_target_id: target.id,
    };
    const { data: objData, error: objErr } = await sb.from('objecten').insert(objectPayload).select('id').single();
    throwIf(objErr);
    await updateTarget(targetId, { status: 'object_aangemaakt', objectId: objData.id });
    return { objectId: objData.id as string };
  }, [targets, user, updateTarget]);

  return (
    <AcquisitieContext.Provider value={{
      targets, campagnes, laden, refresh,
      addTarget, updateTarget, deleteTarget,
      addCampagne, updateCampagne, deleteCampagne,
      converteerNaarObject,
    }}>
      {children}
    </AcquisitieContext.Provider>
  );
}

export function useAcquisitie() {
  const ctx = useContext(AcquisitieContext);
  if (!ctx) throw new Error('useAcquisitie buiten AcquisitieProvider gebruikt');
  return ctx;
}
