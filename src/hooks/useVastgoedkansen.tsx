import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  BriefStatus,
  EigenaarOnderzoekStatus,
  KadasterOnderzoekStatus,
  ReactieStatus,
  Vastgoedkans,
  VastgoedkansHerkomst,
  VastgoedkansStatus,
} from '@/lib/vastgoedkansen';

const sb = supabase as any;

const fromDb = (r: any): Vastgoedkans => ({
  id: r.id,
  kansnummer: r.kansnummer,
  adres: r.adres,
  postcode: r.postcode,
  plaats: r.plaats,
  provincie: r.provincie,
  typeVastgoed: r.type_vastgoed,
  korteOmschrijving: r.korte_omschrijving,
  herkomst: r.herkomst,
  herkomstReferentie: r.herkomst_referentie,
  selectieprofielId: r.selectieprofiel_id,
  selectierunId: r.selectierun_id,
  bagPandId: r.bag_pand_id,
  bagVerblijfsobjectId: r.bag_verblijfsobject_id,
  algoritmeScore: r.algoritme_score,
  scoreUitleg: r.score_uitleg,
  status: r.status,
  prioriteit: r.prioriteit ?? 3,
  eigenaarStatus: r.eigenaar_status,
  eigenaarNaam: r.eigenaar_naam,
  eigenaarBron: r.eigenaar_bron,
  eigenaarRelatieId: r.eigenaar_relatie_id ?? null,
  eigenaarLaatstGecontroleerdOp: r.eigenaar_laatst_gecontroleerd_op,
  kadasterStatus: r.kadaster_status ?? 'niet_gestart',
  kadastraleAanduiding: r.kadastrale_aanduiding,
  kadasterLaatstGecontroleerdOp: r.kadaster_laatst_gecontroleerd_op,
  onderzoeksnotities: r.onderzoeksnotities,
  briefStatus: r.brief_status,
  briefGeadresseerde: r.brief_geadresseerde,
  briefVerzendwijze: r.brief_verzendwijze,
  briefVerzondenOp: r.brief_verzonden_op,
  briefKenmerk: r.brief_kenmerk,
  opvolgdatum: r.opvolgdatum,
  opvolgactie: r.opvolgactie,
  reactieStatus: r.reactie_status ?? 'geen_reactie',
  reactieOntvangenOp: r.reactie_ontvangen_op,
  reactieKanaal: r.reactie_kanaal,
  reactieSamenvatting: r.reactie_samenvatting,
  reactieUitkomst: r.reactie_uitkomst,
  volgendeActieDatum: r.volgende_actie_datum,
  volgendeActieOmschrijving: r.volgende_actie_omschrijving,
  redenInteressant: r.reden_interessant,
  notities: r.notities,
  objectId: r.object_id,
  archivedAt: r.archived_at ?? null,
  archivedBy: r.archived_by ?? null,
  archivedReason: r.archived_reason ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface KansInput {
  adres?: string;
  postcode?: string;
  plaats?: string;
  provincie?: string;
  typeVastgoed?: string;
  korteOmschrijving?: string;
  herkomst?: VastgoedkansHerkomst;
  herkomstReferentie?: string;
  status?: VastgoedkansStatus;
  prioriteit?: number;
  eigenaarStatus?: EigenaarOnderzoekStatus;
  eigenaarNaam?: string;
  eigenaarBron?: string;
  eigenaarRelatieId?: string | null;
  eigenaarLaatstGecontroleerdOp?: string | null;
  kadasterStatus?: KadasterOnderzoekStatus;
  kadastraleAanduiding?: string;
  kadasterLaatstGecontroleerdOp?: string | null;
  onderzoeksnotities?: string;
  briefStatus?: BriefStatus;
  briefGeadresseerde?: string;
  briefVerzendwijze?: string;
  briefVerzondenOp?: string | null;
  briefKenmerk?: string;
  opvolgdatum?: string | null;
  opvolgactie?: string;
  reactieStatus?: ReactieStatus;
  reactieOntvangenOp?: string | null;
  reactieKanaal?: string;
  reactieSamenvatting?: string;
  reactieUitkomst?: string;
  volgendeActieDatum?: string | null;
  volgendeActieOmschrijving?: string;
  redenInteressant?: string;
  notities?: string;
  bagPandId?: string;
  bagVerblijfsobjectId?: string;
}

export interface VastgoedkansBulkWijziging {
  status?: VastgoedkansStatus;
  prioriteit?: number;
}

const snake = (x: KansInput) => ({
  adres: x.adres || null,
  postcode: x.postcode || null,
  plaats: x.plaats || null,
  provincie: x.provincie || null,
  type_vastgoed: x.typeVastgoed || null,
  korte_omschrijving: x.korteOmschrijving || null,
  herkomst: x.herkomst ?? 'handmatig',
  herkomst_referentie: x.herkomstReferentie || null,
  status: x.status ?? 'te_beoordelen',
  prioriteit: x.prioriteit ?? 3,
  eigenaar_status: x.eigenaarStatus ?? 'niet_gestart',
  eigenaar_naam: x.eigenaarNaam || null,
  eigenaar_bron: x.eigenaarBron || null,
  eigenaar_relatie_id: x.eigenaarRelatieId === undefined ? undefined : x.eigenaarRelatieId,
  eigenaar_laatst_gecontroleerd_op: x.eigenaarLaatstGecontroleerdOp || null,
  kadaster_status: x.kadasterStatus ?? 'niet_gestart',
  kadastrale_aanduiding: x.kadastraleAanduiding || null,
  kadaster_laatst_gecontroleerd_op: x.kadasterLaatstGecontroleerdOp || null,
  onderzoeksnotities: x.onderzoeksnotities || null,
  brief_status: x.briefStatus ?? 'niet_gestart',
  brief_geadresseerde: x.briefGeadresseerde || null,
  brief_verzendwijze: x.briefVerzendwijze || null,
  brief_verzonden_op: x.briefVerzondenOp || null,
  brief_kenmerk: x.briefKenmerk || null,
  opvolgdatum: x.opvolgdatum || null,
  opvolgactie: x.opvolgactie || null,
  reactie_status: x.reactieStatus ?? 'geen_reactie',
  reactie_ontvangen_op: x.reactieOntvangenOp || null,
  reactie_kanaal: x.reactieKanaal || null,
  reactie_samenvatting: x.reactieSamenvatting || null,
  reactie_uitkomst: x.reactieUitkomst || null,
  volgende_actie_datum: x.volgendeActieDatum || null,
  volgende_actie_omschrijving: x.volgendeActieOmschrijving || null,
  reden_interessant: x.redenInteressant || null,
  notities: x.notities || null,
  bag_pand_id: x.bagPandId || null,
  bag_verblijfsobject_id: x.bagVerblijfsobjectId || null,
});

type C = {
  kansen: Vastgoedkans[];
  archief: Vastgoedkans[];
  laden: boolean;
  refresh: () => Promise<void>;
  addKans: (x: KansInput) => Promise<void>;
  updateKans: (id: string, x: KansInput) => Promise<void>;
  bulkUpdateKansen: (ids: string[], wijziging: VastgoedkansBulkWijziging) => Promise<void>;
  archiveKansen: (ids: string[], reden?: string) => Promise<void>;
  restoreKansen: (ids: string[]) => Promise<void>;
  updateEigenaarRelatie: (id: string, relatieId: string | null) => Promise<void>;
  getKansById: (id: string) => Vastgoedkans | undefined;
};

const Ctx = createContext<C | undefined>(undefined);

export function VastgoedkansenProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [kansen, setKansen] = useState<Vastgoedkans[]>([]);
  const [archief, setArchief] = useState<Vastgoedkans[]>([]);
  const [laden, setLaden] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setKansen([]);
      setArchief([]);
      return;
    }
    setLaden(true);
    try {
      const { data, error } = await sb.from('vastgoedkansen').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      const alle = (data ?? []).map(fromDb);
      setKansen(alle.filter((k) => !k.archivedAt));
      setArchief(alle.filter((k) => !!k.archivedAt));
    } finally {
      setLaden(false);
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addKans = useCallback(async (x: KansInput) => {
    const { data, error } = await sb.from('vastgoedkansen').insert({ ...snake(x), aangemaakt_door: user?.id ?? null }).select().single();
    if (error) throw error;
    setKansen((p) => [fromDb(data), ...p]);
  }, [user]);

  const updateKans = useCallback(async (id: string, x: KansInput) => {
    const { data, error } = await sb.from('vastgoedkansen').update(snake(x)).eq('id', id).select().single();
    if (error) throw error;
    const next = fromDb(data);
    setKansen((p) => next.archivedAt ? p.filter((k) => k.id !== id) : p.map((k) => k.id === id ? next : k));
    setArchief((p) => next.archivedAt ? p.map((k) => k.id === id ? next : k) : p.filter((k) => k.id !== id));
  }, []);

  const bulkUpdateKansen = useCallback(async (ids: string[], wijziging: VastgoedkansBulkWijziging) => {
    if (ids.length === 0) return;
    const patch: Record<string, unknown> = {};
    if (wijziging.status !== undefined) patch.status = wijziging.status;
    if (wijziging.prioriteit !== undefined) {
      if (!Number.isInteger(wijziging.prioriteit) || wijziging.prioriteit < 1 || wijziging.prioriteit > 5) {
        throw new Error('Prioriteit moet tussen 1 en 5 liggen.');
      }
      patch.prioriteit = wijziging.prioriteit;
    }
    if (Object.keys(patch).length === 0) return;

    const { data, error } = await sb
      .from('vastgoedkansen')
      .update(patch)
      .in('id', ids)
      .is('archived_at', null)
      .select('*');
    if (error) throw error;

    const gewijzigd = (data ?? []).map(fromDb);
    const perId = new Map<string, Vastgoedkans>(gewijzigd.map((kans: Vastgoedkans) => [kans.id, kans]));
    setKansen((vorig) => vorig.map((kans) => perId.get(kans.id) ?? kans));
  }, []);

  const archiveKansen = useCallback(async (ids: string[], reden = 'Handmatig gearchiveerd') => {
    if (ids.length === 0) return;
    const { data: u } = await supabase.auth.getUser();
    const nu = new Date().toISOString();
    const { data, error } = await sb.from('vastgoedkansen').update({ archived_at: nu, archived_by: u.user?.id ?? null, archived_reason: reden }).in('id', ids).is('archived_at', null).select('*');
    if (error) throw error;
    const gewijzigd = (data ?? []).map(fromDb);
    const set = new Set(gewijzigd.map((k: Vastgoedkans) => k.id));
    setKansen((p) => p.filter((k) => !set.has(k.id)));
    setArchief((p) => [...gewijzigd, ...p.filter((k) => !set.has(k.id))]);
  }, []);

  const restoreKansen = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data, error } = await sb.from('vastgoedkansen').update({ archived_at: null, archived_by: null, archived_reason: null }).in('id', ids).not('archived_at', 'is', null).select('*');
    if (error) throw error;
    const gewijzigd = (data ?? []).map(fromDb);
    const set = new Set(gewijzigd.map((k: Vastgoedkans) => k.id));
    setArchief((p) => p.filter((k) => !set.has(k.id)));
    setKansen((p) => [...gewijzigd, ...p.filter((k) => !set.has(k.id))]);
  }, []);

  const updateEigenaarRelatie = useCallback(async (id: string, relatieId: string | null) => {
    const { data, error } = await sb.from('vastgoedkansen').update({ eigenaar_relatie_id: relatieId }).eq('id', id).select().single();
    if (error) throw error;
    const next = fromDb(data);
    setKansen((p) => p.map((k) => k.id === id ? next : k));
    setArchief((p) => p.map((k) => k.id === id ? next : k));
  }, []);

  const getKansById = useCallback((id: string) => kansen.find((k) => k.id === id) ?? archief.find((k) => k.id === id), [kansen, archief]);

  return <Ctx.Provider value={{ kansen, archief, laden, refresh, addKans, updateKans, bulkUpdateKansen, archiveKansen, restoreKansen, updateEigenaarRelatie, getKansById }}>{children}</Ctx.Provider>;
}

export const useVastgoedkansen = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useVastgoedkansen buiten provider');
  return c;
};
