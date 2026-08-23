import { copyProfielLabel } from '@/lib/acquisitie/copyExperimenten';
import {
  beoordeelExperiment,
  type ExperimentPlaybookModel,
  type ExperimentVariantRij,
} from '@/lib/acquisitie/experimentPlaybook';

export interface AcquisitieConversieEvent {
  occurred_at: string;
  acquisitie_bron: string | null;
  event_type: string;
  brief_id: string | null;
  kanaal: string | null;
  status?: string | null;
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

export type ResponsKwaliteit =
  | 'ongeclassificeerd'
  | 'negatief'
  | 'neutraal_info'
  | 'positief_gesprek'
  | 'gekwalificeerde_lead';

export interface ConversieRij {
  sleutel: string;
  label: string;
  verzonden: number;
  reacties: number;
  positieveReacties: number;
  kwalitatieveReacties: number;
  gekwalificeerdeLeads: number;
  responspercentage: number;
  positieveResponspercentage: number;
  kwalitatieveResponspercentage: number;
  gekwalificeerdeLeadPercentage: number;
}

export interface ResponsKwaliteitSamenvatting {
  ongeclassificeerd: number;
  negatief: number;
  neutraalInfo: number;
  positiefGesprek: number;
  gekwalificeerdeLead: number;
}

export interface AcquisitieConversieDashboardModel {
  totaal: ConversieRij;
  perKanaal: ConversieRij[];
  perTouchpoint: ConversieRij[];
  perMaand: ConversieRij[];
  perVariant: ConversieRij[];
  experimenten: ExperimentPlaybookModel[];
  responsKwaliteit: ResponsKwaliteitSamenvatting;
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

/**
 * Strikte kwaliteitsindeling voor experimentsturing. Dit verandert de bestaande
 * responsstatus niet; het is een afgeleide meetlaag bovenop de canonieke status.
 */
export function classificeerResponsKwaliteit(status: string | null | undefined): ResponsKwaliteit {
  if (status === 'gesprek_gepland') return 'gekwalificeerde_lead';
  if (status === 'interesse') return 'positief_gesprek';
  if (status === 'wil_meer_informatie' || status === 'later_opnieuw_benaderen') return 'neutraal_info';
  if (status === 'niet_geinteresseerd' || status === 'verkocht_of_niet_relevant' || status === 'afgevallen') return 'negatief';
  return 'ongeclassificeerd';
}

function maakRij(
  sleutel: string,
  label: string,
  verzonden: number,
  reacties: number,
  positieveReacties: number,
  kwalitatieveReacties = 0,
  gekwalificeerdeLeads = 0,
): ConversieRij {
  return {
    sleutel,
    label,
    verzonden,
    reacties,
    positieveReacties,
    kwalitatieveReacties,
    gekwalificeerdeLeads,
    responspercentage: pct(reacties, verzonden),
    positieveResponspercentage: pct(positieveReacties, verzonden),
    kwalitatieveResponspercentage: pct(kwalitatieveReacties, verzonden),
    gekwalificeerdeLeadPercentage: pct(gekwalificeerdeLeads, verzonden),
  };
}

export function bouwAcquisitieConversieDashboard(
  events: AcquisitieConversieEvent[],
  briefMeta: AcquisitieBriefMeta[],
  jaar: number,
  nu = new Date(),
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

  const kwaliteitPerBrief = new Map<string, ResponsKwaliteit>();
  for (const [briefId, event] of reactiePerBrief.entries()) {
    kwaliteitPerBrief.set(briefId, classificeerResponsKwaliteit(event.status));
  }

  const kwalitatiefPerBrief = new Set(
    [...kwaliteitPerBrief.entries()]
      .filter(([, kwaliteit]) => kwaliteit === 'positief_gesprek' || kwaliteit === 'gekwalificeerde_lead')
      .map(([briefId]) => briefId),
  );
  const gekwalificeerdPerBrief = new Set(
    [...kwaliteitPerBrief.entries()]
      .filter(([, kwaliteit]) => kwaliteit === 'gekwalificeerde_lead')
      .map(([briefId]) => briefId),
  );

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
      const kwalitatieve = ids.filter(id => kwalitatiefPerBrief.has(id)).length;
      const gekwalificeerde = ids.filter(id => gekwalificeerdPerBrief.has(id)).length;
      return maakRij(sleutel, groep.label, ids.length, reacties, positieve, kwalitatieve, gekwalificeerde);
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

  const experimentGroepen = new Map<string, {
    profiel: string;
    kanaal: string;
    campagneStap: string;
    eersteVerzending: string;
    briefIds: string[];
  }>();

  for (const [briefId, event] of gelabeldeVarianten) {
    const meta = metaPerBrief.get(briefId);
    if (!meta?.copy_profiel || !meta.campagne_stap) continue;
    const kanaal = event.kanaal || 'onbekend';
    const sleutel = `${meta.copy_profiel}:${kanaal}:${meta.campagne_stap}`;
    const bestaand = experimentGroepen.get(sleutel);
    const eersteVerzending = bestaand && new Date(bestaand.eersteVerzending) < new Date(event.occurred_at)
      ? bestaand.eersteVerzending
      : event.occurred_at;
    experimentGroepen.set(sleutel, {
      profiel: meta.copy_profiel,
      kanaal,
      campagneStap: meta.campagne_stap,
      eersteVerzending,
      briefIds: [...(bestaand?.briefIds ?? []), briefId],
    });
  }

  const experimenten = [...experimentGroepen.entries()].map(([sleutel, groep]) => {
    const variantenMap = new Map<string, string[]>();
    for (const briefId of groep.briefIds) {
      const code = metaPerBrief.get(briefId)?.copy_variant_code || '?';
      variantenMap.set(code, [...(variantenMap.get(code) ?? []), briefId]);
    }
    const varianten: ExperimentVariantRij[] = [...variantenMap.entries()].map(([code, ids]) => {
      const reacties = ids.filter(id => reactiePerBrief.has(id)).length;
      const positieve = ids.filter(id => positiefPerBrief.has(id)).length;
      return {
        ...maakRij(
          `${sleutel}:${code}`,
          `Variant ${code}`,
          ids.length,
          reacties,
          positieve,
          ids.filter(id => kwalitatiefPerBrief.has(id)).length,
          ids.filter(id => gekwalificeerdPerBrief.has(id)).length,
        ),
        variantCode: code,
        isControl: code === 'A',
      };
    }).sort((a, b) => a.variantCode.localeCompare(b.variantCode));

    return beoordeelExperiment({
      sleutel,
      label: `${copyProfielLabel(groep.profiel)} · ${touchpointLabel(groep.campagneStap)}`,
      profiel: groep.profiel,
      kanaal: groep.kanaal,
      campagneStap: groep.campagneStap,
      eersteVerzending: groep.eersteVerzending,
      varianten,
      nu,
    });
  }).sort((a, b) => {
    const statusVolgorde = ['kandidaat_winnaar', 'beslismoment', 'dataverzameling', 'opstart', 'wacht_op_challenger'];
    const statusDelta = statusVolgorde.indexOf(a.status) - statusVolgorde.indexOf(b.status);
    return statusDelta || a.label.localeCompare(b.label);
  });

  const totaalVerzonden = jaarVerzendingen.length;
  const totaalReacties = reactiePerBrief.size;
  const totaalPositief = positiefPerBrief.size;
  const totaalKwalitatief = kwalitatiefPerBrief.size;
  const totaalGekwalificeerd = gekwalificeerdPerBrief.size;

  const responsKwaliteit: ResponsKwaliteitSamenvatting = {
    ongeclassificeerd: 0,
    negatief: 0,
    neutraalInfo: 0,
    positiefGesprek: 0,
    gekwalificeerdeLead: 0,
  };
  for (const kwaliteit of kwaliteitPerBrief.values()) {
    if (kwaliteit === 'negatief') responsKwaliteit.negatief += 1;
    else if (kwaliteit === 'neutraal_info') responsKwaliteit.neutraalInfo += 1;
    else if (kwaliteit === 'positief_gesprek') responsKwaliteit.positiefGesprek += 1;
    else if (kwaliteit === 'gekwalificeerde_lead') responsKwaliteit.gekwalificeerdeLead += 1;
    else responsKwaliteit.ongeclassificeerd += 1;
  }

  const reactiesZonderVerzending = events.filter(event =>
    event.telt_reactie === true && event.brief_id && !verzondenPerBrief.has(event.brief_id),
  ).length;

  return {
    totaal: maakRij('totaal', `${jaar}`, totaalVerzonden, totaalReacties, totaalPositief, totaalKwalitatief, totaalGekwalificeerd),
    perKanaal,
    perTouchpoint,
    perMaand,
    perVariant,
    experimenten,
    responsKwaliteit,
    variantGelabeld: gelabeldeVarianten.length,
    variantOngelabeld: totaalVerzonden - gelabeldeVarianten.length,
    reactiesZonderVerzending,
  };
}
