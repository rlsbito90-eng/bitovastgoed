// Centrale chip-stijlen voor Vastgoedrekenen.
// Bito-huisstijl: navy / goud structuur, groen alleen voor OK,
// amber alleen voor aandacht, rood alleen voor blockers.
//
// Korte labels uit één bron — lange uitleg hoort in tooltip / audit.

export type ChipKind =
  | 'ok'
  | 'let_op'
  | 'info'
  | 'nvt'
  | 'incompleet'
  | 'handmatig'
  | 'leidend';

export const CHIP_LABEL: Record<ChipKind, string> = {
  ok: 'OK',
  let_op: 'LET OP',
  info: 'INFO',
  nvt: 'NVT',
  incompleet: 'INCOMPLEET',
  handmatig: 'HANDMATIG',
  leidend: 'LEIDEND',
};

export const CHIP_CLS: Record<ChipKind, string> = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  let_op: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40',
  info: 'bg-muted text-muted-foreground border-border',
  nvt: 'bg-muted/60 text-muted-foreground/80 border-border/70',
  incompleet: 'bg-destructive/12 text-destructive border-destructive/40',
  handmatig: 'bg-accent/12 text-accent-foreground border-accent/40',
  leidend: 'bg-primary/10 text-primary border-primary/30',
};

/** Tailwind-class voor een compacte, consistente Vastgoedrekenen-chip. */
export function chipClass(kind: ChipKind): string {
  return `inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wide ${CHIP_CLS[kind]}`;
}

/** Korte chip-label. Voor lange uitleg: gebruik title/tooltip naast de chip. */
export function chipLabel(kind: ChipKind): string {
  return CHIP_LABEL[kind];
}
