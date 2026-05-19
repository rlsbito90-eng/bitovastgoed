import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/** Inklapbare "Hoe wordt dit berekend?"-uitleg. */
export default function BerekeningUitleg({ titel = 'Hoe wordt dit berekend?', children }: { titel?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {titel}
      </button>
      {open && <div className="mt-1.5 pl-4 border-l border-border text-muted-foreground leading-relaxed">{children}</div>}
    </div>
  );
}
