import { copyProfielLabel } from '@/lib/acquisitie/copyExperimenten';

export interface AcquisitieConversieEvent {
  occurred_at: string;
  acquisitie_bron: string | null;
  event_type: string;
  brief_id: string | null;
  kanaal: string | null;
  telt_verzonden_communicatie: boolean | null;
  telt_reactie: boolean | null;
  telt_positieve_reactie: boolean | null;
}

export interface AcquisitieBriefMeta {
  id: string;
  campagne_stap: string | null;
  copy_profiel?: string | null;
  copy_variant_key?: string | null;
  copy_variant_code?: string | null;
  copy_hypothese?: string | null;
}

export interface ConversieRij {
  sleutel: string;
  label: string;
  verzonden: number;
  reacties: number;
  positieveReacties: number;
  responspercentage: number;
  positieveResponspercentage: number;
}

export interface AcquisitieConversieDashboardModel {
  totaal: ConversieRij;
  perKanaal: ConversieRij[];
  perTouchpoint: ConversieRij[];
  perMaand: ConversieRij[];
  perVariant: ConversieRij[];
  variantGelabeld: number;
  variantOngelabeld: number;
  reactiesZonderVerzending: number;
}

const pct = (teller: number, noemer: number) => noemer > 0
  ? Math.round((teller / noemer) * 10_000) / 100
  : 0;

const kanaalLabel = (kanaal: string) => {
  if (kanaal === 'email') return 'E-mail';
  if (kanaal === 'post') return 'Post';
  return kanaal || 'Onbekend';
};

const touchpointLabel = (stap: string) => {
  if (stap === 'brief_1') return 'Brief 1';
  if (stap === 'brief_2') return 'Brief 2';
  if (stap === 'brief_3') return 'Brief 3';
  if (stap === 'email_1') return 'E-mail 1';
  if (stap === 'email_2') return 'E-mail 2';
  if (stap === 'email_3') return 'E-mail 3';
  return stap || 'Onbekend touchpoint';
};

function maakRij(sleutel: string, label: string, verzonden: number, reacties: number, positieveReacties: number): ConversieRij {
  return {
    sleutel,
    label,
    verzonden,
    reacties,
    positieveReacties,
    responspercentage: pct(reacties, verzonden),
    positieveResponspercentage: pct(positieveReacties, verzonden),
  };
}

export function bouwAcquisitieConversieDashboard(
  events: AcquisitieConversieEvent[],
  briefMeta: AcquisitieBriefMeta[],
  jaar: number,
): AcquisitieConversieDashboardModel {
  const metaPerBrief = new Map(briefMeta.map(rij => [rij.id, rij]));
  const verzonden = events.filter(event => event.telt_verzonden_communicatie === true && event.brief_id);
  const verzondenPerBrief = new Map<string, AcquisitieConversieEvent>();

  for (const event of verzonden) {
    const briefId = event.brief_id!;
    const bestaand = verzondenPerBrief.get(briefId);
    if (!bestaand || new Date(event.occurred_at).getTime() < new Date(bestaand.occurred_at).getTime()) {
      verzondenPerBrief.set(briefId, event);
    }
  }

  const jaarVerzendingen = [...verzondenPerBrief.entries()].filter(([, event]) =>
    new Date(event.occurred_at).getFullYear() === jaar,
  );
  const jaarBriefIds = new Set(jaarVerzendingen.map(([briefId]) => briefId));

  const reactiePerBrief = new Map<string, AcquisitieConversieEvent>();
  for (const event of events) {
    if (!event.brief_id || event.telt_reactie !== true || !jaarBriefIds.has(event.brief_id)) continue;
    reactiePerBrief.set(event.brief_id, event);
  }

  const positiefPerBrief = new Set<string>();
  for (const event of events) {
    if (!event.brief_id || event.telt_positieve_reactie !== true || !jaarBriefIds.has(event.brief_id)) continue;
    positiefPerBrief.add(event.brief_id);
  }

  const groepen = (
    sleutelFn: (briefId: string, event: AcquisitieConversieEvent) => [string, string],
    bron: Array<[string, AcquisitieConversieEvent]> = jaarVerzendingen,
  ) => {
    const map = new Map<string, { label: string; ids: Set<string> }>();
    for (const [briefId, event] of bron) {
      const [sleutel, label] = sleutelFn(briefId, event);
      const groep = map.get(sleutel) ?? { label, ids: new Set<string>() };
      groep.ids.add(briefId);
      map.set(sleutel, groep);
    }
    return [...map.entries()].map(([sleutel, groep]) => {
      const ids = [...groep.ids];
      const reacties = ids.filter(id => reactiePerBrief.has(id)).length;
      const positieve = ids.filter(id => positiefPerBrief.has(id)).length;
      return maakRij(sleutel, groep.label, ids.length, reacties, positieve);
    });
  };

  const perKanaal = groepen((_, event) => {
    const sleutel = event.kanaal || 'onbekend';
    return [sleutel, kanaalLabel(sleutel)];
  }).sort((a, b) => b.verzonden - a.verzonden);

  const perTouchpoint = groepen((briefId) => {
    const sleutel = metaPerBrief.get(briefId)?.campagne_stap || 'onbekend';
    return [sleutel, touchpointLabel(sleutel)];
  }).sort((a, b) => b.verzonden - a.verzonden);

  const perMaand = groepen((_, event) => {
    const datum = new Date(event.occurred_at);
    const sleutel = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('nl-NL', { month: 'short', year: 'numeric' }).format(datum);
    return [sleutel, label];
  }).sort((a, b) => a.sleutel.localeCompare(b.sleutel));

  const gelabeldeVarianten = jaarVerzendingen.filter(([briefId]) => !!metaPerBrief.get(briefId)?.copy_variant_key);
  const perVariant = groepen((briefId) => {
    const meta = metaPerBrief.get(briefId);
    const sleutel = meta?.copy_variant_key || 'onbekend';
    const profiel = copyProfielLabel(meta?.copy_profiel);
    const stap = touchpointLabel(meta?.campagne_stap || 'onbekend');
    const code = meta?.copy_variant_code || '?';
    return [sleutel, `${profiel} · ${stap} · Variant ${code}`];
  }, gelabeldeVarianten).sort((a, b) => b.verzonden - a.verzonden);

  const totaalVerzonden = jaarVerzendingen.length;
  const totaalReacties = reactiePerBrief.size;
  const totaalPositief = positiefPerBrief.size;

  const reactiesZonderVerzending = events.filter(event =>
    event.telt_reactie === true && event.brief_id && !verzondenPerBrief.has(event.brief_id),
  ).length;

  return {
    totaal: maakRij('totaal', `${jaar}`, totaalVerzonden, totaalReacties, totaalPositief),
    perKanaal,
    perTouchpoint,
    perMaand,
    perVariant,
    variantGelabeld: gelabeldeVarianten.length,
    variantOngelabeld: totaalVerzonden - gelabeldeVarianten.length,
    reactiesZonderVerzending,
  };
}
