import type { VastgoedkansStatus } from './vastgoedkansen';

export interface VastgoedkansStatusPresentatie {
  chip: string;
  row: string;
  marker: string;
}

export const VASTGOEDKANS_STATUS_PRESENTATIE: Record<VastgoedkansStatus, VastgoedkansStatusPresentatie> = {
  te_beoordelen: {
    chip: 'border-warning/40 bg-warning/10 text-warning',
    row: 'border-l-4 border-l-warning/55',
    marker: 'bg-warning',
  },
  onderzoek: {
    chip: 'border-primary/35 bg-primary/10 text-primary',
    row: 'border-l-4 border-l-primary/45',
    marker: 'bg-primary',
  },
  brief_voorbereiden: {
    chip: 'border-accent/40 bg-accent/10 text-accent-foreground',
    row: 'border-l-4 border-l-accent/55',
    marker: 'bg-accent',
  },
  opvolgen: {
    chip: 'border-warning/45 bg-warning/10 text-warning',
    row: 'border-l-4 border-l-warning/70',
    marker: 'bg-warning',
  },
  wachten: {
    chip: 'border-border bg-muted/60 text-muted-foreground',
    row: 'border-l-4 border-l-border',
    marker: 'bg-muted-foreground',
  },
  positieve_reactie: {
    chip: 'border-success/40 bg-success/10 text-success',
    row: 'border-l-4 border-l-success/60',
    marker: 'bg-success',
  },
  afgevallen: {
    chip: 'border-destructive/35 bg-destructive/10 text-destructive',
    row: 'border-l-4 border-l-destructive/50',
    marker: 'bg-destructive',
  },
  gepromoveerd: {
    chip: 'border-success/40 bg-success/10 text-success',
    row: 'border-l-4 border-l-success/70',
    marker: 'bg-success',
  },
};

export function vastgoedkansStatusChipClass(status: VastgoedkansStatus, actief = false): string {
  const basis = 'shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors';
  if (actief) return `${basis} ${VASTGOEDKANS_STATUS_PRESENTATIE[status].chip} font-semibold ring-1 ring-current/20`;
  return `${basis} ${VASTGOEDKANS_STATUS_PRESENTATIE[status].chip} opacity-75 hover:opacity-100`;
}

export function vastgoedkansStatusRowClass(status: VastgoedkansStatus): string {
  return VASTGOEDKANS_STATUS_PRESENTATIE[status].row;
}
