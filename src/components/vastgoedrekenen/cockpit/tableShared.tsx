// Gedeelde helpers voor compacte componententabellen (sub-fase 4C).
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export type ChipTone = 'positive' | 'warning' | 'muted';

export const chipCls = (tone?: ChipTone) =>
  tone === 'warning' ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/5'
  : tone === 'positive' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5'
  : 'border-border text-muted-foreground bg-muted/30';

export function Chip({ label, tone }: { label: string; tone?: ChipTone }) {
  return <span className={`inline-block text-[11px] rounded-full border px-2 py-0.5 whitespace-normal break-words ${chipCls(tone)}`}>{label}</span>;
}

/** Veld-wrapper in detail-drawer: label boven invoer, geen truncation. */
export function DrawerField({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className ?? ''}`}>
      <Label className="block text-xs font-medium leading-snug whitespace-normal break-words">{label}</Label>
      <div className="min-w-0 [&_input]:w-full [&_[role=combobox]]:w-full [&_textarea]:w-full">{children}</div>
    </div>
  );
}
