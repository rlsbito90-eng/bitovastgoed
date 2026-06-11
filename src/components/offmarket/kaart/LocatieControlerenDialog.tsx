import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { GeocodeOnzeker } from '@/hooks/useKaartGeocoding';
import type { GeocodeKandidaat } from '@/lib/offMarket/kaart/geocode';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: GeocodeOnzeker[];
  onKies: (signaal_id: string, kandidaat: GeocodeKandidaat) => Promise<void>;
}

export default function LocatieControlerenDialog({ open, onOpenChange, items, onKies }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Locatie controleren ({items.length})</DialogTitle>
          <DialogDescription>
            PDOK heeft geen eenduidige match gevonden. Kies handmatig het juiste adres of laat het signaal staan.
          </DialogDescription>
        </DialogHeader>
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Geen onzekere locaties op dit moment.
          </p>
        )}
        <ul className="space-y-4">
          {items.map(item => (
            <li key={item.signaal_id} className="rounded-lg border border-border p-3">
              <div className="font-medium text-sm">{item.titel}</div>
              <div className="text-xs text-muted-foreground mb-1">
                {[item.adres, [item.postcode, item.plaats].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
              </div>
              <div className="text-[11px] text-muted-foreground italic mb-2">Reden: {item.reden}</div>
              <ul className="space-y-1.5">
                {item.kandidaten.map(k => (
                  <li key={k.id} className="flex items-center justify-between gap-2 rounded border border-border/60 p-2">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{k.weergavenaam}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[k.postcode, k.woonplaats].filter(Boolean).join(' · ')}
                        {k.score ? ` · score ${k.score.toFixed(2)}` : ''}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await onKies(item.signaal_id, k);
                          toast({ title: 'Locatie opgeslagen', description: k.weergavenaam });
                        } catch {
                          toast({ title: 'Opslaan mislukt', variant: 'destructive' });
                        }
                      }}
                    >
                      Gebruik deze
                    </Button>
                  </li>
                ))}
                {item.kandidaten.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">Geen PDOK-kandidaten gevonden.</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
