import type { ComputedOutputs } from './types';

export type ReadinessCategory = 'invoer' | 'betrouwbaarheid' | 'fiscaal' | 'controle';

export type ReadinessItem = {
  category: ReadinessCategory;
  label: string;
  message: string;
};

export type ScenarioReadiness = {
  status: 'voor_bieding' | 'indicatief';
  shortLabel: 'Voor bieding' | 'Indicatief / incompleet';
  title: string;
  summary: string;
  items: ReadinessItem[];
};

const CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  invoer: 'Invoer aanvullen',
  betrouwbaarheid: 'Onderbouwing verbeteren',
  fiscaal: 'Fiscaal controleren',
  controle: 'Controleren',
};

function normalizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, ' ');
}

function categoryFor(message: string): ReadinessCategory {
  if (/\b(ovb|btw|fisca|overdrachtsbelasting|verrekenbaarheid|vrijgesteld|vrijgestelde)\b/i.test(message)) {
    return 'fiscaal';
  }
  if (/betrouw|bron|peildatum|onderbouw|indicatief|handmatig|marktvalidatie|marktwaarde|bouwkosten/i.test(message)) {
    return 'betrouwbaarheid';
  }
  if (/ontbre|zonder|\bvul\b|voeg|niet ingevuld|onvoldoende data|geen doelwinst|geen verkoop|geen huur|geen waarde/i.test(message)) {
    return 'invoer';
  }
  return 'controle';
}

function uniqueMessages(messages: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of messages) {
    if (!raw) continue;
    const message = normalizeMessage(raw);
    if (!message) continue;
    const key = message.toLocaleLowerCase('nl-NL');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(message);
  }
  return result;
}

function summaryFor(items: ReadinessItem[], reliability: ComputedOutputs['inputReliability']): string {
  const categories = new Set(items.map((item) => item.category));
  const parts: string[] = [];
  if (categories.has('invoer')) parts.push('verplichte invoer ontbreekt');
  if (categories.has('betrouwbaarheid') || reliability === 'laag') parts.push('onderbouwing is nog onvoldoende betrouwbaar');
  if (categories.has('fiscaal')) parts.push('fiscale behandeling vraagt controle');
  if (categories.has('controle') && parts.length === 0) parts.push('open controlepunten moeten worden afgehandeld');
  if (parts.length === 0) return 'De berekening is rekenkundig compleet op basis van de vastgelegde uitgangspunten.';
  const sentence = parts.join(', ').replace(/, ([^,]*)$/, ' en $1');
  return `Nog niet geschikt als biedingsbasis: ${sentence}.`;
}

/**
 * Orden bestaande reken- en validatiesignalen tot een korte werklijst.
 * Deze helper introduceert geen nieuwe markt- of rekenaannames.
 */
export function buildScenarioReadiness(outputs: ComputedOutputs): ScenarioReadiness {
  const residualIssues = outputs.residual?.criticalIssues ?? [];
  const messages = uniqueMessages([
    ...residualIssues,
    ...outputs.scoreAttentionPoints,
    ...outputs.warnings,
  ]);

  if (outputs.inputReliability === 'laag' && !messages.some((message) => categoryFor(message) === 'betrouwbaarheid')) {
    messages.push('De belangrijkste opbrengst- en kosteninvoer heeft nog een lage betrouwbaarheid; leg bron en peildatum vast.');
  }

  const items = messages
    .map((message): ReadinessItem => {
      const category = categoryFor(message);
      return { category, label: CATEGORY_LABELS[category], message };
    })
    .slice(0, 4);

  const ready = outputs.residual?.status === 'voor_bieding' && residualIssues.length === 0;
  return {
    status: ready ? 'voor_bieding' : 'indicatief',
    shortLabel: ready ? 'Voor bieding' : 'Indicatief / incompleet',
    title: ready ? 'Geschikt als rekenbasis voor bieding' : 'Nog niet geschikt voor bieding',
    summary: ready
      ? 'De berekening is compleet op basis van de ingevoerde uitgangspunten. Dit blijft een haalbaarheidsberekening en geen formele taxatie of fiscale goedkeuring.'
      : summaryFor(items, outputs.inputReliability),
    items,
  };
}
