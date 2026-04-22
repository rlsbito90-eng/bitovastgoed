// src/components/object/MultiSelectChips.tsx
// Herbruikbaar multi-select met klikbare chips. Veel gebruiksvriendelijker
// dan kommagescheiden tekstvelden voor regio's, provincies, etc.

import { Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  groep?: string;
}

interface Props {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  className?: string;
}

export default function MultiSelectChips({
  options,
  value,
  onChange,
  emptyLabel,
  className = '',
}: Props) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  };

  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {emptyLabel ?? 'Geen opties beschikbaar'}
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map(opt => {
        const actief = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`inline-flex items-center gap-1 h-8 px-3 rounded-full border text-sm transition-colors ${
              actief
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card text-foreground border-border hover:bg-muted/60'
            }`}
          >
            {actief && <Check className="h-3 w-3" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
