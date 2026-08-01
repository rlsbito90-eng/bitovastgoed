// Lichte, lokale voorkeurenlaag voor de Vastgoedrekenen-werkruimte.
// Uitsluitend presentatie: welke overzichtswidgets zichtbaar zijn en in welke volgorde.
// Geen database, geen invloed op financiële data.

export const VR_LAYOUT_STORAGE_KEY = 'vr.workspace.layout.v1';

export const VR_WIDGETS = ['statistieken', 'recent', 'snelacties'] as const;
export type VrWidgetId = (typeof VR_WIDGETS)[number];

export const VR_WIDGET_LABELS: Record<VrWidgetId, string> = {
  statistieken: 'Kerncijfers',
  recent: 'Recente berekeningen',
  snelacties: 'Snelle acties',
};

export type VrLayoutPrefs = {
  order: VrWidgetId[];
  hidden: VrWidgetId[];
};

export const VR_DEFAULT_LAYOUT: VrLayoutPrefs = {
  order: [...VR_WIDGETS],
  hidden: [],
};

function isWidget(value: unknown): value is VrWidgetId {
  return typeof value === 'string' && (VR_WIDGETS as readonly string[]).includes(value);
}

/** Normaliseert (mogelijk verouderde) opgeslagen voorkeuren naar een volledige, geldige layout. */
export function normalizeLayoutPrefs(input: unknown): VrLayoutPrefs {
  const raw = (input ?? {}) as Partial<VrLayoutPrefs>;
  const order: VrWidgetId[] = [];
  for (const id of Array.isArray(raw.order) ? raw.order : []) {
    if (isWidget(id) && !order.includes(id)) order.push(id);
  }
  for (const id of VR_WIDGETS) {
    if (!order.includes(id)) order.push(id);
  }
  const hidden = (Array.isArray(raw.hidden) ? raw.hidden : []).filter(isWidget);
  return { order, hidden: [...new Set(hidden)] };
}

export function loadLayoutPrefs(): VrLayoutPrefs {
  if (typeof window === 'undefined') return { ...VR_DEFAULT_LAYOUT, order: [...VR_WIDGETS] };
  try {
    const raw = window.localStorage.getItem(VR_LAYOUT_STORAGE_KEY);
    if (!raw) return { ...VR_DEFAULT_LAYOUT, order: [...VR_WIDGETS] };
    return normalizeLayoutPrefs(JSON.parse(raw));
  } catch {
    return { ...VR_DEFAULT_LAYOUT, order: [...VR_WIDGETS] };
  }
}

export function saveLayoutPrefs(prefs: VrLayoutPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VR_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeLayoutPrefs(prefs)));
  } catch {
    // opslag niet beschikbaar: standaardlayout blijft werken
  }
}

export function resetLayoutPrefs(): VrLayoutPrefs {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(VR_LAYOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return { ...VR_DEFAULT_LAYOUT, order: [...VR_WIDGETS] };
}

export function toggleWidget(prefs: VrLayoutPrefs, id: VrWidgetId): VrLayoutPrefs {
  const hidden = prefs.hidden.includes(id)
    ? prefs.hidden.filter((w) => w !== id)
    : [...prefs.hidden, id];
  return { order: [...prefs.order], hidden };
}

export function moveWidget(prefs: VrLayoutPrefs, id: VrWidgetId, direction: -1 | 1): VrLayoutPrefs {
  const order = [...prefs.order];
  const index = order.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return prefs;
  [order[index], order[target]] = [order[target], order[index]];
  return { order, hidden: [...prefs.hidden] };
}

export function visibleWidgets(prefs: VrLayoutPrefs): VrWidgetId[] {
  return prefs.order.filter((id) => !prefs.hidden.includes(id));
}
