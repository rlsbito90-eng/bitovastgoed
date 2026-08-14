import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export type EigenaarContactType = 'telefoon' | 'email' | 'whatsapp' | 'linkedin' | 'notitie' | 'algemeen';
export type EigenaarContactRichting = 'inkomend' | 'uitgaand' | 'intern' | 'n_v_t';

export interface EigenaarContactMoment {
  id: string;
  moment_date: string;
  moment_time: string | null;
  type: EigenaarContactType;
  direction: EigenaarContactRichting;
  title: string;
  description: string | null;
  outcome: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  eigenaar_id: string;
  vastgoedkans_id: string;
  relatie_id: string | null;
  object_id: string | null;
  created_at: string;
}

export interface EigenaarTaak {
  id: string;
  titel: string;
  type_taak: string | null;
  deadline: string | null;
  prioriteit: 'laag' | 'normaal' | 'hoog' | 'urgent';
  status: 'open' | 'in_uitvoering' | 'wacht_op_reactie' | 'afgerond' | 'geannuleerd';
  notities: string | null;
  eigenaar_id: string;
  vastgoedkans_id: string;
  relatie_id: string | null;
  object_id: string | null;
  created_at: string;
}

export interface NieuwEigenaarContactMoment {
  vastgoedkansId: string;
  eigenaarId: string;
  relatieId?: string | null;
  objectId?: string | null;
  type: EigenaarContactType;
  direction: EigenaarContactRichting;
  datum: string;
  tijd?: string | null;
  titel: string;
  beschrijving?: string | null;
  uitkomst?: string | null;
  vervolgdatum?: string | null;
}

export interface NieuweEigenaarTaak {
  vastgoedkansId: string;
  eigenaarId: string;
  relatieId?: string | null;
  objectId?: string | null;
  titel: string;
  type?: string;
  deadline: string;
  prioriteit?: EigenaarTaak['prioriteit'];
  notities?: string | null;
}

async function haalContactmomenten(vastgoedkansId: string, eigenaarId: string): Promise<EigenaarContactMoment[]> {
  const { data, error } = await sb
    .from('contact_moments')
    .select('id,moment_date,moment_time,type,direction,title,description,outcome,follow_up_required,follow_up_date,eigenaar_id,vastgoedkans_id,relatie_id,object_id,created_at')
    .eq('vastgoedkans_id', vastgoedkansId)
    .eq('eigenaar_id', eigenaarId)
    .order('moment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EigenaarContactMoment[];
}

async function haalTaken(vastgoedkansId: string, eigenaarId: string): Promise<EigenaarTaak[]> {
  const { data, error } = await sb
    .from('taken')
    .select('id,titel,type_taak,deadline,prioriteit,status,notities,eigenaar_id,vastgoedkans_id,relatie_id,object_id,created_at')
    .eq('vastgoedkans_id', vastgoedkansId)
    .eq('eigenaar_id', eigenaarId)
    .is('soft_deleted_at', null)
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EigenaarTaak[];
}

async function voegContactmomentToe(input: NieuwEigenaarContactMoment) {
  const { data, error } = await sb.from('contact_moments').insert({
    moment_date: input.datum,
    moment_time: input.tijd || null,
    type: input.type,
    direction: input.direction,
    title: input.titel.trim(),
    description: input.beschrijving?.trim() || null,
    outcome: input.uitkomst?.trim() || null,
    follow_up_required: Boolean(input.vervolgdatum),
    follow_up_date: input.vervolgdatum || null,
    eigenaar_id: input.eigenaarId,
    vastgoedkans_id: input.vastgoedkansId,
    relatie_id: input.relatieId || null,
    object_id: input.objectId || null,
    is_system: false,
  }).select('*').single();
  if (error) throw error;
  return data;
}

async function voegTaakToe(input: NieuweEigenaarTaak) {
  const { data, error } = await sb.from('taken').insert({
    titel: input.titel.trim(),
    type_taak: input.type || 'Follow-up',
    deadline: input.deadline,
    prioriteit: input.prioriteit || 'normaal',
    status: 'open',
    notities: input.notities?.trim() || null,
    eigenaar_id: input.eigenaarId,
    vastgoedkans_id: input.vastgoedkansId,
    relatie_id: input.relatieId || null,
    object_id: input.objectId || null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export function useVastgoedkansEigenaarActiviteit(vastgoedkansId: string, eigenaarId: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(vastgoedkansId && eigenaarId);
  const sleutel = ['eigenaar-activiteit', 'vastgoedkans', vastgoedkansId, eigenaarId];

  const contacten = useQuery({
    queryKey: [...sleutel, 'contactmomenten'],
    enabled,
    queryFn: () => haalContactmomenten(vastgoedkansId, eigenaarId!),
  });

  const taken = useQuery({
    queryKey: [...sleutel, 'taken'],
    enabled,
    queryFn: () => haalTaken(vastgoedkansId, eigenaarId!),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['eigenaar-activiteit', 'vastgoedkans', vastgoedkansId] });
  };

  const voegContactToe = useMutation({ mutationFn: voegContactmomentToe, onSuccess: invalidate });
  const voegTaak = useMutation({ mutationFn: voegTaakToe, onSuccess: invalidate });

  return {
    contacten: contacten.data ?? [],
    taken: taken.data ?? [],
    isLoading: contacten.isLoading || taken.isLoading,
    error: contacten.error ?? taken.error,
    voegContactToe,
    voegTaak,
  };
}
