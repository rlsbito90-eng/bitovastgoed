import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { ObjectVastgoed } from '@/data/mock-data';
import { analyseerObjectIntegriteit } from '@/lib/objecten/objectIntegriteit';

export function ObjectIntegriteitSamenvatting({ objecten }: { objecten: ObjectVastgoed[] }) {
  const [open, setOpen] = useState(false);
  const rapport = useMemo(() => analyseerObjectIntegriteit(objecten), [objecten]);

  if (rapport.issues.length === 0) {
    return (
      <div className="section-card p-3.5 flex items-center gap-3 text-sm">
        <ShieldCheck className="h-5 w-5 text-success shrink-0" />
        <div>
          <p className="font-medium text-foreground">Objectintegriteit op orde</p>
          <p className="text-xs text-muted-foreground">Geen ontbrekende kernadressen of mogelijke duplicaten gevonden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card overflow-hidden">
      <button type="button" onClick={() => setOpen(value => !value)} className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Objectintegriteitscontrole</p>
            <p className="text-xs text-muted-foreground">{rapport.objectenMetIssues} van {rapport.totaalObjecten} objecten vragen controle · read-only</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border p-3.5 space-y-2">
          {rapport.issues.slice(0, 12).map((issue, index) => (
            <div key={`${issue.code}-${index}`} className="rounded-md border border-border/70 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{issue.titel}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{issue.ernst}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{issue.toelichting}</p>
            </div>
          ))}
          {rapport.issues.length > 12 && <p className="text-xs text-muted-foreground">Nog {rapport.issues.length - 12} controles niet weergegeven.</p>}
          <p className="text-[11px] text-muted-foreground pt-1">Deze controle wijzigt, koppelt of archiveert geen gegevens automatisch.</p>
        </div>
      )}
    </div>
  );
}
