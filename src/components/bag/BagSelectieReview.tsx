import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BagSelectiePreflight } from '@/lib/bag/selectiePreflight';

interface Props {
  preflight: BagSelectiePreflight;
  redenLabel: (reden: BagSelectiePreflight['blokkades'][number]['reden']) => string;
  onVerwijder: (bagPandId: string) => void;
  onToevoegen: () => void;
}

export default function BagSelectieReview({ preflight, redenLabel, onVerwijder, onToevoegen }: Props) {
  return (
    <div className={`p-4 text-sm ${preflight.toegestaan ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {preflight.kandidaten.length} pand{preflight.kandidaten.length === 1 ? '' : 'en'} klaar om toe te voegen
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {preflight.geselecteerd} gecontroleerd · {preflight.blokkades.length} uitgesloten. Er is nog niets opgeslagen.
          </p>
        </div>
        {preflight.toegestaan && (
          <Button size="sm" onClick={onToevoegen}>Toevoegen aan Vastgoedkansen</Button>
        )}
      </div>

      {preflight.kandidaten.length > 0 && (
        <div className="mt-3 space-y-2">
          {preflight.kandidaten.map(pand => (
            <div key={pand.bagPandId} className="flex items-center justify-between gap-3 rounded-md border bg-background/70 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{pand.adres}</p>
                <p className="truncate text-[11px] text-muted-foreground">{[pand.postcode, pand.plaats, pand.wijkNaam, pand.buurtNaam].filter(Boolean).join(' · ')}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => onVerwijder(pand.bagPandId)}>
                <X className="mr-1 h-3.5 w-3.5" />Verwijder
              </Button>
            </div>
          ))}
        </div>
      )}

      {preflight.blokkades.length > 0 && (
        <div className="mt-3 rounded-md border bg-background/70 p-3">
          <p className="text-xs font-medium">Uitgesloten</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {preflight.blokkades.map(item => (
              <li key={`${item.bagPandId}:${item.reden}`}>{item.bagPandId}: {redenLabel(item.reden)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
