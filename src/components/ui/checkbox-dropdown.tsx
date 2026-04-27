import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxDropdownOption {
  value: string;
  label: string;
}

interface CheckboxDropdownProps {
  label: string;
  options: CheckboxDropdownOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** Maximale breedte v/d trigger */
  triggerWidth?: string;
}

/**
 * Compacte multi-select dropdown met checkboxes. Houdt zich aan het ontwerpsysteem
 * (semantische tokens, geen rauwe kleuren).
 */
export function CheckboxDropdown({
  label,
  options,
  selected,
  onChange,
  className,
  triggerWidth = 'sm:w-52',
}: CheckboxDropdownProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter(v => v !== value));
    else onChange([...selected, value]);
  };

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? label
      : `${label} · ${selected.length}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-10 px-3 justify-between font-normal bg-card text-foreground hover:bg-card',
            'w-full',
            triggerWidth,
            selected.length > 0 && 'border-primary/50 text-foreground',
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selected.length > 0 && (
              <button
                type="button"
                aria-label="Wis selectie"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange([]);
                }}
                className="hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5">
        <div className="px-2 py-1.5 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Wis
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {options.map(opt => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors text-left"
              >
                <span
                  className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                    checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background',
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="text-foreground">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
