// Kleine waarschuwingsbadge voor records zonder volgende actie of met
// een verlopen volgende actie. App-breed gebruikt op lijsten en detailpagina's.
import { AlertCircle, Clock } from 'lucide-react';

interface Props {
  variant?: 'geen' | 'verlopen';
  date?: string | null;
  size?: 'xs' | 'sm';
  className?: string;
}

export default function GeenActieBadge({ variant = 'geen', date, size = 'xs', className = '' }: Props) {
  const isVerlopen = variant === 'verlopen';
  const Icon = isVerlopen ? Clock : AlertCircle;
  const tekst = isVerlopen
    ? `Verlopen${date ? ` · ${new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` : ''}`
    : 'Geen volgende actie';
  const sizeCls = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  const colorCls = isVerlopen
    ? 'bg-destructive/10 text-destructive border-destructive/30'
    : 'bg-warning/10 text-warning-foreground border-warning/30';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeCls} ${colorCls} ${className}`}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
      {tekst}
    </span>
  );
}

/** Helper: bepaal of een datum in het verleden ligt (excl. vandaag). */
export function isVerlopen(datum?: string | null): boolean {
  if (!datum) return false;
  const d = new Date(datum); d.setHours(0, 0, 0, 0);
  const nu = new Date(); nu.setHours(0, 0, 0, 0);
  return d.getTime() < nu.getTime();
}
