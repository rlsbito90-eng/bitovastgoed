import { ArrowUpDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { SortOption } from '@/lib/sorting/types';

interface Props<T> {
  options: SortOption<T>[];
  value: string;
  onChange: (next: string) => void;
  /** Optionele compact-modus (mobiel toont alleen icoon + waarde). */
  className?: string;
}

/**
 * App-brede sorteer-dropdown. Toont "Sorteer: {label}" met dropdown van opties.
 * Werkt naast bestaande filters; sortering wordt door de pagina toegepast.
 */
export default function SortDropdown<T>({ options, value, onChange, className }: Props<T>) {
  const huidige = options.find(o => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            'inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground hover:bg-muted transition-colors whitespace-nowrap min-w-0 ' +
            (className ?? '')
          }
          aria-label="Sorteren"
        >
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="hidden sm:inline text-muted-foreground">Sorteer:</span>
          <span className="font-medium truncate">{huidige?.label ?? '—'}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Sorteren op
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(opt => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex items-center justify-between gap-2"
          >
            <span>{opt.label}</span>
            {opt.value === value && <Check className="h-4 w-4 text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
