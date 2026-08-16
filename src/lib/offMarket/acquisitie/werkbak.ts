// Fase 1 — Werkbakken, subfilters, procesdatums en Werkvolgorde-sortering
// voor de Off-Market Radar Acquisitieselectie.
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { ReadinessFase, SignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import { vandaagNl, isDatumInToekomstNl } from '@/lib/datum/nlDatum';

export type Werkbak = 'actie' | 'wachten' | 'afgehandeld';
export type WerkbakView = Werkbak | 'alles';

export type ActieSubfilter =
  | 'alle'
  | 'onderzoeken'
  | 'eigenaar_controleren'
  | 'adres_achterhalen'
  | 'brief_voorbereiden'
  | 'printen_posten'
  | 'opvolgen';

export type ActieCategorie =
  | 'opvolging_verlopen'
  | 'opvolging_vandaag'
  | 'opvolging_plannen'
  | 'geprint_nog_posten'
  | 'gereed_voor_print'
  | 'concept_controleren'
  | 'brief_voorbereiden'
  | 'adres_achterhalen'
  | 'eigenaar_controleren'
  | 'onderzoek';

export interface ProcesDatum {
  iso: string | null;
  label: string;
  a11yLabel: string;
}

export interface WerkbakContext {
  werkbak: Werkbak;
  actieCategorie: ActieCategorie | null;
  actieSubfilter: ActieSubfilter | null;
  procesDatum: ProcesDatum | null;
}

export const FASE_WERKBAK: Record<ReadinessFase, Werkbak> = {
  onderzoek_nodig: 'actie',
  eigenaar_ontbreekt: 'actie',
  eigenaar_controleren: 'actie',
  adres_ontbreekt: 'actie',
  brief_voorbereiden: 'actie',
  concept_gereed: 'actie',
  gereed_voor_print: 'actie',
  geprint: 'actie',
  gepost: 'actie',
  email_verzonden: 'actie',
  opvolging_open: 'actie',
  afgerond: 'afgehandeld',
};

function vandaagISO(): string { return vandaagNl(); }
function isDatumInToekomst(iso: string, vandaag = vandaagISO()): boolean {
  return isDatumInToekomstNl(iso, vandaag);
}
function actieveBrieven(brieven: OffMarketBrief[]): OffMarketBrief[] {
  return brieven.filter(b => !b.archived_at);
}

function heeftUitsluitendToekomstigeOpvolging(brieven: OffMarketBrief[], vandaag = vandaagISO()): boolean {
  const actief = actieveBrieven(brieven);
  if (actief.length === 0) return false;
  let heeftToekomstig = false;
  for (const b of actief) {
    const respons = b.responsstatus ?? null;
    if (respons && respons !== 'geen_reactie') continue;
    const status = b.status ?? null;
    const vs = (b.verzendstatus ?? '') as string;
    const isVerzonden = status === 'verstuurd' || vs === 'gepost' || vs === 'verzonden';
    if (!isVerzonden) return false;
    const opv = b.opvolgdatum ?? null;
    if (!opv || !isDatumInToekomst(opv, vandaag)) return false;
    heeftToekomstig = true;
  }
  return heeftToekomstig;
}

function eerstvolgendeToekomstigeOpvolgdatum(brieven: OffMarketBrief[], vandaag = vandaagISO()): string | null {
  let laagste: string | null = null;
  for (const b of actieveBrieven(brieven)) {
    const opv = b.opvolgdatum ?? null;
    const respons = b.responsstatus ?? null;
    if (respons && respons !== 'geen_reactie') continue;
    if (!opv || !isDatumInToekomst(opv, vandaag)) continue;
    if (laagste === null || opv < laagste) laagste = opv;
  }
  return laagste;
}

function vroegsteOpvolgdatumOpen(brieven: OffMarketBrief[], vandaag = vandaagISO()): string | null {
  let laagste: string | null = null;
  for (const b of actieveBrieven(brieven)) {
    const opv = b.opvolgdatum ?? null;
    const respons = b.responsstatus ?? null;
    if (respons && respons !== 'geen_reactie') continue;
    if (!opv || opv > vandaag) continue;
    if (laagste === null || opv < laagste) laagste = opv;
  }
  return laagste;
}

function vroegstePrintdatum(brieven: OffMarketBrief[]): string | null {
  const kandidaten = actieveBrieven(brieven).filter(b => {
    const kanaal = (b.kanaal ?? 'post') as string;
    if (kanaal !== 'post' || b.status === 'verstuurd') return false;
    const vs = (b.verzendstatus ?? '') as string;
    return vs === 'geprint' || vs === 'in_envelop';
  });
  let laagste: string | null = null;
  for (const b of kandidaten) {
    const d = b.printdatum ?? null;
    if (d && (laagste === null || d < laagste)) laagste = d;
  }
  if (laagste) return laagste;
  const sorted = [...kandidaten].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const c = sorted[0]?.created_at ?? null;
  return c ? c.slice(0, 10) : null;
}

function conceptdatum(brieven: OffMarketBrief[]): string | null {
  const kandidaten = actieveBrieven(brieven).filter(b => {
    const kanaal = (b.kanaal ?? 'post') as string;
    return kanaal === 'post' && b.status === 'concept';
  });
  if (kandidaten.length === 0) return null;
  const sorted = [...kandidaten].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const c = sorted[0]?.created_at ?? null;
  return c ? c.slice(0, 10) : null;
}

type AfrondingsBron = 'respons' | 'gearchiveerd';
interface Afronding { iso: string; bron: AfrondingsBron; }

function afrondingsdatum(brieven: OffMarketBrief[], signaal: OffMarketSignaal): Afronding | null {
  let laatste: string | null = null;
  for (const b of actieveBrieven(brieven)) {
    const r = b.responsdatum ?? null;
    if (r && (!laatste || r > laatste)) laatste = r.slice(0, 10);
  }
  if (laatste) return { iso: laatste, bron: 'respons' };
  const gearchiveerd = (signaal as { gearchiveerd_op?: string | null }).gearchiveerd_op ?? null;
  return gearchiveerd ? { iso: gearchiveerd.slice(0, 10), bron: 'gearchiveerd' } : null;
}

function relatiefLabel(iso: string): { relatief: string; volledig: string } {
  try {
    const d = parseISO(iso.length > 10 ? iso : `${iso}T12:00:00Z`);
    return {
      relatief: formatDistanceToNow(d, { addSuffix: true, locale: nl }),
      volledig: format(d, 'd MMMM yyyy', { locale: nl }),
    };
  } catch { return { relatief: iso, volledig: iso }; }
}
function korteDatum(iso: string): string {
  try { return format(parseISO(iso.length > 10 ? iso : `${iso}T12:00:00Z`), 'd MMM', { locale: nl }); }
  catch { return iso; }
}
function volledigeDatum(iso: string): string {
  try { return format(parseISO(iso.length > 10 ? iso : `${iso}T12:00:00Z`), 'd MMMM yyyy', { locale: nl }); }
  catch { return iso; }
}

export interface BepaalWerkbakInput {
  signaal: OffMarketSignaal;
  readiness: SignaalReadiness;
  brieven: OffMarketBrief[];
  toegevoegdOp: string | null;
  vandaag?: string;
}

export function bepaalWerkbakContext(input: BepaalWerkbakInput): WerkbakContext {
  const { signaal, readiness, brieven, vandaag = vandaagISO() } = input;
  const fase = readiness.fase;
  const baseWerkbak = FASE_WERKBAK[fase];
  if (baseWerkbak === 'afgehandeld') {
    const afr = afrondingsdatum(brieven, signaal);
    if (!afr) return { werkbak: 'afgehandeld', actieCategorie: null, actieSubfilter: null, procesDatum: { iso: null, label: 'Afgehandeld', a11yLabel: 'Afgehandeld' } };
    const prefix = afr.bron === 'respons' ? 'Reactie op' : 'Gearchiveerd op';
    return {
      werkbak: 'afgehandeld', actieCategorie: null, actieSubfilter: null,
      procesDatum: { iso: afr.iso, label: `${prefix} ${korteDatum(afr.iso)}`, a11yLabel: `${prefix} ${volledigeDatum(afr.iso)}` },
    };
  }
  if ((fase === 'gepost' || fase === 'email_verzonden') && heeftUitsluitendToekomstigeOpvolging(brieven, vandaag)) {
    const iso = eerstvolgendeToekomstigeOpvolgdatum(brieven, vandaag);
    return {
      werkbak: 'wachten', actieCategorie: null, actieSubfilter: null,
      procesDatum: iso ? { iso, label: `Wachten tot ${korteDatum(iso)}`, a11yLabel: `Wachten tot ${volledigeDatum(iso)}` } : null,
    };
  }
  const { categorie, subfilter, procesDatum } = bepaalActie(fase, brieven, vandaag);
  return { werkbak: 'actie', actieCategorie: categorie, actieSubfilter: subfilter, procesDatum };
}

function bepaalActie(
  fase: ReadinessFase,
  brieven: OffMarketBrief[],
  vandaag: string,
): { categorie: ActieCategorie; subfilter: ActieSubfilter; procesDatum: ProcesDatum | null } {
  switch (fase) {
    case 'onderzoek_nodig':
    case 'eigenaar_ontbreekt':
      return { categorie: 'onderzoek', subfilter: 'onderzoeken', procesDatum: { iso: null, label: 'Nog niet onderzocht', a11yLabel: 'Nog niet onderzocht' } };
    case 'eigenaar_controleren':
      return { categorie: 'eigenaar_controleren', subfilter: 'eigenaar_controleren', procesDatum: { iso: null, label: 'Eigenaar controleren', a11yLabel: 'Eigenaar/recht controleren' } };
    case 'adres_ontbreekt':
      return { categorie: 'adres_achterhalen', subfilter: 'adres_achterhalen', procesDatum: { iso: null, label: 'Adres achterhalen', a11yLabel: 'Verzendadres van bekende eigenaar achterhalen' } };
    case 'brief_voorbereiden':
      return { categorie: 'brief_voorbereiden', subfilter: 'brief_voorbereiden', procesDatum: { iso: null, label: 'Nog geen concept', a11yLabel: 'Nog geen concept' } };
    case 'concept_gereed': {
      const iso = conceptdatum(brieven);
      return { categorie: 'concept_controleren', subfilter: 'brief_voorbereiden', procesDatum: iso
        ? { iso, label: `Concept ${relatiefLabel(iso).relatief}`, a11yLabel: `Concept op ${volledigeDatum(iso)}` }
        : { iso: null, label: 'Concept controleren', a11yLabel: 'Concept controleren' } };
    }
    case 'gereed_voor_print': {
      const iso = conceptdatum(brieven);
      return { categorie: 'gereed_voor_print', subfilter: 'printen_posten', procesDatum: iso
        ? { iso, label: `Klaar voor print · concept ${relatiefLabel(iso).relatief}`, a11yLabel: `Klaar voor print, concept op ${volledigeDatum(iso)}` }
        : { iso: null, label: 'Klaar voor print', a11yLabel: 'Klaar voor print' } };
    }
    case 'geprint': {
      const iso = vroegstePrintdatum(brieven);
      return { categorie: 'geprint_nog_posten', subfilter: 'printen_posten', procesDatum: iso
        ? { iso, label: `Geprint ${relatiefLabel(iso).relatief}`, a11yLabel: `Geprint op ${volledigeDatum(iso)}` }
        : { iso: null, label: 'Geprint', a11yLabel: 'Geprint' } };
    }
    case 'opvolging_open': {
      const iso = vroegsteOpvolgdatumOpen(brieven, vandaag);
      const isVandaag = iso === vandaag;
      const cat: ActieCategorie = isVandaag ? 'opvolging_vandaag' : 'opvolging_verlopen';
      return { categorie: cat, subfilter: 'opvolgen', procesDatum: iso
        ? { iso, label: isVandaag ? 'Opvolgen vandaag' : `Opvolgen sinds ${korteDatum(iso)}`, a11yLabel: isVandaag ? 'Opvolgen vandaag' : `Opvolgen sinds ${volledigeDatum(iso)}` }
        : { iso: null, label: 'Opvolgen', a11yLabel: 'Opvolgen' } };
    }
    case 'gepost':
    case 'email_verzonden':
      return { categorie: 'opvolging_plannen', subfilter: 'opvolgen', procesDatum: {
        iso: null,
        label: fase === 'email_verzonden' ? 'E-mail verzonden · opvolging plannen' : 'Gepost · opvolging plannen',
        a11yLabel: fase === 'email_verzonden' ? 'E-mail verzonden, opvolging plannen' : 'Gepost, opvolging plannen',
      } };
    case 'afgerond':
      return { categorie: 'onderzoek', subfilter: 'alle', procesDatum: null };
  }
}

const ACTIE_RANG: Record<ActieCategorie, number> = {
  opvolging_verlopen: 10,
  opvolging_vandaag: 20,
  opvolging_plannen: 30,
  geprint_nog_posten: 40,
  gereed_voor_print: 50,
  concept_controleren: 60,
  brief_voorbereiden: 70,
  adres_achterhalen: 73,
  eigenaar_controleren: 75,
  onderzoek: 80,
};
const WERKBAK_RANG: Record<Werkbak, number> = { actie: 0, wachten: 100, afgehandeld: 200 };

export interface SorteerRij {
  signaalId: string;
  toegevoegdOp: string | null;
  ctx: WerkbakContext;
  procesDatumIsoWachten: string | null;
}

export function sorteerWerkvolgorde(view: WerkbakView, rijen: SorteerRij[]): SorteerRij[] {
  const arr = [...rijen];
  arr.sort((a, b) => vergelijk(view, a, b));
  return arr;
}

function vergelijk(view: WerkbakView, a: SorteerRij, b: SorteerRij): number {
  if (view === 'alles') {
    const wa = WERKBAK_RANG[a.ctx.werkbak];
    const wb = WERKBAK_RANG[b.ctx.werkbak];
    if (wa !== wb) return wa - wb;
    return vergelijk(a.ctx.werkbak, a, b);
  }
  if (view === 'actie') {
    const ra = a.ctx.actieCategorie ? ACTIE_RANG[a.ctx.actieCategorie] : 999;
    const rb = b.ctx.actieCategorie ? ACTIE_RANG[b.ctx.actieCategorie] : 999;
    if (ra !== rb) return ra - rb;
    const da = a.ctx.procesDatum?.iso ?? '';
    const db = b.ctx.procesDatum?.iso ?? '';
    if (da !== db) return da.localeCompare(db);
    const ta = a.toegevoegdOp ?? '';
    const tb = b.toegevoegdOp ?? '';
    if (ta !== tb) return ta.localeCompare(tb);
    return a.signaalId.localeCompare(b.signaalId);
  }
  if (view === 'wachten') {
    const da = a.procesDatumIsoWachten ?? a.ctx.procesDatum?.iso ?? '';
    const db = b.procesDatumIsoWachten ?? b.ctx.procesDatum?.iso ?? '';
    if (da !== db) return da.localeCompare(db);
    const ta = a.toegevoegdOp ?? '';
    const tb = b.toegevoegdOp ?? '';
    if (ta !== tb) return ta.localeCompare(tb);
    return a.signaalId.localeCompare(b.signaalId);
  }
  const da = a.ctx.procesDatum?.iso ?? '';
  const db = b.ctx.procesDatum?.iso ?? '';
  if (da !== db) return db.localeCompare(da);
  const ta = a.toegevoegdOp ?? '';
  const tb = b.toegevoegdOp ?? '';
  if (ta !== tb) return tb.localeCompare(ta);
  return a.signaalId.localeCompare(b.signaalId);
}

export const WERKBAK_LABEL: Record<WerkbakView, string> = {
  actie: 'Actie', wachten: 'Wachten', afgehandeld: 'Afgehandeld', alles: 'Alles',
};
export const ACTIE_SUBFILTER_LABEL: Record<ActieSubfilter, string> = {
  alle: 'Alle acties',
  onderzoeken: 'Onderzoeken',
  eigenaar_controleren: 'Eigenaar controleren',
  adres_achterhalen: 'Adres achterhalen',
  brief_voorbereiden: 'Brief voorbereiden',
  printen_posten: 'Printen & posten',
  opvolgen: 'Opvolgen',
};

export function toegevoegdOpLabel(iso: string | null): { relatief: string; volledig: string } | null {
  return iso ? relatiefLabel(iso) : null;
}
