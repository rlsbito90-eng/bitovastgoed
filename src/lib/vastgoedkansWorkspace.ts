import type { Vastgoedkans } from '@/lib/vastgoedkansen';

export type VastgoedkansWerkTab = 'overzicht' | 'kadaster' | 'brieven' | 'dossier';

export interface VastgoedkansWerkcontext {
  tab: VastgoedkansWerkTab;
  kansId: string;
  werkbak?: string;
  zoekterm?: string;
  ids?: string[];
  bijgewerktOp: string;
}

const STORAGE_KEY = 'bito-vastgoedkansen-werkcontext-v1';

export function bepaalPrimaireWerkTab(kans: Vastgoedkans): VastgoedkansWerkTab {
  if (kans.kadasterStatus !== 'afgerond' || kans.eigenaarStatus !== 'bekend') return 'kadaster';
  if (kans.briefStatus !== 'verzonden' && kans.briefStatus !== 'reactie_ontvangen') return 'brieven';
  return kans.status === 'opvolgen' || kans.status === 'wachten' ? 'brieven' : 'overzicht';
}

export function bouwEigenaarGoogleUrl(naam: string, plaats?: string | null): string | null {
  const schoon = naam.trim();
  if (!schoon) return null;
  const query = [`\"${schoon}\"`, plaats?.trim(), 'vastgoed'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function bewaarVastgoedkansWerkcontext(context: Omit<VastgoedkansWerkcontext, 'bijgewerktOp'>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...context, bijgewerktOp: new Date().toISOString() }));
}

export function leesVastgoedkansWerkcontext(): VastgoedkansWerkcontext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as VastgoedkansWerkcontext;
    if (!value?.kansId || !['overzicht', 'kadaster', 'brieven', 'dossier'].includes(value.tab)) return null;
    return value;
  } catch {
    return null;
  }
}

export function bepaalWerkcontextNavigatie(ids: string[], huidigId: string) {
  const index = ids.indexOf(huidigId);
  return {
    index,
    total: ids.length,
    vorigeId: index > 0 ? ids[index - 1] : null,
    volgendeId: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null,
  };
}
