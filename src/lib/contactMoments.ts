// src/lib/contactMoments.ts
// Centrale types, labels, helpers en logger voor de Contactmomenten / Tijdlijn module.

import { supabase } from '@/integrations/supabase/client';
import {
  Phone, Mail, MessageCircle, Linkedin, CalendarCheck, Eye, StickyNote,
  FileText, Send, FileSignature, FileInput, Share2,
  Coins, BadgeEuro, Repeat, CheckSquare, PlusSquare,
  UserPlus, Archive, Activity, type LucideIcon,
} from 'lucide-react';

// ---------- Types ----------
export type ContactMomentType =
  | 'telefoon' | 'email' | 'whatsapp' | 'linkedin'
  | 'afspraak' | 'bezichtiging' | 'notitie'
  | 'document_gedeeld' | 'teaser_verstuurd' | 'nda_verstuurd' | 'nda_ontvangen' | 'informatie_gedeeld'
  | 'bod_ontvangen' | 'bod_uitgebracht'
  | 'status_gewijzigd' | 'taak_aangemaakt' | 'taak_afgerond' | 'kandidaat_toegevoegd'
  | 'archief' | 'algemeen';

export type ContactMomentDirection = 'inkomend' | 'uitgaand' | 'intern' | 'n_v_t';

export interface ContactMoment {
  id: string;
  momentDate: string;
  momentTime?: string;
  type: ContactMomentType;
  direction: ContactMomentDirection;
  title: string;
  description?: string;
  outcome?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  relatieId?: string;
  objectId?: string;
  dealId?: string;
  acquisitieTargetId?: string;
  taakId?: string;
  isSystem: boolean;
  systemKey?: string;
  aangemaaktDoor?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Labels & visuals ----------
export const CONTACT_MOMENT_TYPE_LABELS: Record<ContactMomentType, string> = {
  telefoon: 'Telefoongesprek',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  afspraak: 'Afspraak',
  bezichtiging: 'Bezichtiging',
  notitie: 'Notitie',
  document_gedeeld: 'Document gedeeld',
  teaser_verstuurd: 'Teaser gestuurd',
  nda_verstuurd: 'NDA verstuurd',
  nda_ontvangen: 'NDA ontvangen',
  informatie_gedeeld: 'Informatie gedeeld',
  bod_ontvangen: 'Bod ontvangen',
  bod_uitgebracht: 'Bod uitgebracht',
  status_gewijzigd: 'Status gewijzigd',
  taak_aangemaakt: 'Taak aangemaakt',
  taak_afgerond: 'Taak afgerond',
  kandidaat_toegevoegd: 'Kandidaat toegevoegd',
  archief: 'Archiefactie',
  algemeen: 'Algemeen',
};

export const CONTACT_MOMENT_TYPE_ICON: Record<ContactMomentType, LucideIcon> = {
  telefoon: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
  afspraak: CalendarCheck,
  bezichtiging: Eye,
  notitie: StickyNote,
  document_gedeeld: FileText,
  teaser_verstuurd: Send,
  nda_verstuurd: FileSignature,
  nda_ontvangen: FileInput,
  informatie_gedeeld: Share2,
  bod_ontvangen: Coins,
  bod_uitgebracht: BadgeEuro,
  status_gewijzigd: Repeat,
  taak_aangemaakt: PlusSquare,
  taak_afgerond: CheckSquare,
  kandidaat_toegevoegd: UserPlus,
  archief: Archive,
  algemeen: Activity,
};

export const CONTACT_MOMENT_DIRECTION_LABELS: Record<ContactMomentDirection, string> = {
  inkomend: 'Inkomend',
  uitgaand: 'Uitgaand',
  intern: 'Intern',
  n_v_t: '—',
};

// Filter-categorieën in tijdlijn-UI
export type TimelineCategory = 'alle' | 'contact' | 'notities' | 'systeem' | 'taken' | 'documenten' | 'biedingen';

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  alle: 'Alle',
  contact: 'Contact',
  notities: 'Notities',
  systeem: 'Systeem',
  taken: 'Taken',
  documenten: 'Documenten',
  biedingen: 'Biedingen',
};

export function categoryOf(type: ContactMomentType): TimelineCategory {
  if (['telefoon', 'email', 'whatsapp', 'linkedin', 'afspraak', 'bezichtiging'].includes(type)) return 'contact';
  if (['notitie', 'algemeen'].includes(type)) return 'notities';
  if (['taak_aangemaakt', 'taak_afgerond'].includes(type)) return 'taken';
  if (['document_gedeeld', 'teaser_verstuurd', 'nda_verstuurd', 'nda_ontvangen', 'informatie_gedeeld'].includes(type)) return 'documenten';
  if (['bod_ontvangen', 'bod_uitgebracht'].includes(type)) return 'biedingen';
  return 'systeem';
}

// ---------- Mappers ----------
export const contactMomentFromDb = (r: any): ContactMoment => ({
  id: r.id,
  momentDate: r.moment_date,
  momentTime: r.moment_time ?? undefined,
  type: r.type,
  direction: r.direction ?? 'n_v_t',
  title: r.title ?? '',
  description: r.description ?? undefined,
  outcome: r.outcome ?? undefined,
  followUpRequired: !!r.follow_up_required,
  followUpDate: r.follow_up_date ?? undefined,
  relatieId: r.relatie_id ?? undefined,
  objectId: r.object_id ?? undefined,
  dealId: r.deal_id ?? undefined,
  acquisitieTargetId: r.acquisitie_target_id ?? undefined,
  taakId: r.taak_id ?? undefined,
  isSystem: !!r.is_system,
  systemKey: r.system_key ?? undefined,
  aangemaaktDoor: r.aangemaakt_door ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const contactMomentToDb = (c: Partial<ContactMoment>) => {
  const out: Record<string, any> = {};
  if (c.momentDate !== undefined) out.moment_date = c.momentDate;
  if (c.momentTime !== undefined) out.moment_time = c.momentTime || null;
  if (c.type !== undefined) out.type = c.type;
  if (c.direction !== undefined) out.direction = c.direction;
  if (c.title !== undefined) out.title = c.title;
  if (c.description !== undefined) out.description = c.description || null;
  if (c.outcome !== undefined) out.outcome = c.outcome || null;
  if (c.followUpRequired !== undefined) out.follow_up_required = c.followUpRequired;
  if (c.followUpDate !== undefined) out.follow_up_date = c.followUpDate || null;
  if (c.relatieId !== undefined) out.relatie_id = c.relatieId || null;
  if (c.objectId !== undefined) out.object_id = c.objectId || null;
  if (c.dealId !== undefined) out.deal_id = c.dealId || null;
  if (c.acquisitieTargetId !== undefined) out.acquisitie_target_id = c.acquisitieTargetId || null;
  if (c.taakId !== undefined) out.taak_id = c.taakId || null;
  if (c.isSystem !== undefined) out.is_system = c.isSystem;
  if (c.systemKey !== undefined) out.system_key = c.systemKey || null;
  if (c.aangemaaktDoor !== undefined) out.aangemaakt_door = c.aangemaaktDoor || null;
  return out;
};

// ---------- Autolog helper ----------
// Wordt rechtstreeks vanuit de datastore aangeroepen. Dedupe via unique system_key.
export async function logSystemContactMoment(input: {
  type: ContactMomentType;
  title: string;
  description?: string;
  relatieId?: string | null;
  objectId?: string | null;
  dealId?: string | null;
  acquisitieTargetId?: string | null;
  taakId?: string | null;
  systemKey?: string;
}): Promise<ContactMoment | null> {
  const payload: any = {
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    direction: 'n_v_t',
    is_system: true,
    system_key: input.systemKey ?? null,
    relatie_id: input.relatieId ?? null,
    object_id: input.objectId ?? null,
    deal_id: input.dealId ?? null,
    acquisitie_target_id: input.acquisitieTargetId ?? null,
    taak_id: input.taakId ?? null,
  };
  const { data, error } = await supabase
    .from('contact_moments' as any)
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) {
    // unique_violation = systemKey al gelogd; geen probleem
    if ((error as any).code !== '23505') console.warn('logSystemContactMoment', error);
    return null;
  }
  return data ? contactMomentFromDb(data) : null;
}

// ---------- Format helpers ----------
export function formatMomentDateTime(date: string, time?: string): string {
  try {
    const d = new Date(date);
    const datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
    return time ? `${datum} · ${time.slice(0, 5)}` : datum;
  } catch {
    return date;
  }
}

export function groupHeaderDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dd.getTime()) / 86400000);
  if (diff === 0) return 'Vandaag';
  if (diff === 1) return 'Gisteren';
  if (diff > 1 && diff < 7) return `${diff} dagen geleden`;
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
