import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      <DialogContent
        className="
          p-0 gap-0 overflow-hidden bg-background
          w-[100vw] max-w-[100vw] h-[100vh] max-h-[100vh] rounded-none border-0
          sm:w-auto sm:max-w-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:border
        "
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-border sticky top-0 bg-background z-10 text-left">
          <DialogTitle>Locatie controleren ({items.length})</DialogTitle>
          <DialogDescription>
            PDOK heeft geen eenduidige match gevonden. Kies handmatig het juiste adres of laat het signaal staan.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Geen onzekere locaties op dit moment.
            </p>
          )}
          <ul className="space-y-4">
            {items.map(item => {
              const beste = item.kandidaten.slice().sort((a, b) => b.score - a.score)[0];
              return (
                <li key={item.signaal_id} className="rounded-lg border border-border p-3 bg-card">
                  <div className="font-medium text-sm break-words">{item.titel}</div>
                  <div className="text-xs text-muted-foreground mb-1 break-words">
                    {[item.adres, [item.postcode, item.plaats].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-2 flex flex-wrap gap-1 items-center">
                    <Badge variant="outline" className="text-[10px]">Reden</Badge>
                    <span className="break-words">{item.reden}</span>
                    <span className="opacity-60">· {item.kandidaten.length} kandidaten</span>
                  </div>
                  <ul className="space-y-2">
                    {item.kandidaten.map(k => (
                      <li
                        key={k.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded border border-border/60 p-2.5 bg-background"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm break-words flex flex-wrap items-center gap-1.5">
                            {k.id === beste?.id && (
                              <Badge variant="secondary" className="text-[10px]">Beste</Badge>
                            )}
                            <span>{k.weergavenaam}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground break-words">
                            {[k.postcode, k.woonplaats].filter(Boolean).join(' · ')}
                            {k.score ? ` · score ${k.score.toFixed(2)}` : ''}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto min-h-[40px] shrink-0"
                          onClick={async () => {
                            try {
                              await onKies(item.signaal_id, k);
                              toast({ title: 'Locatie opgeslagen via PDOK', description: k.weergavenaam });
                            } catch {
                              toast({ title: 'Opslaan mislukt', variant: 'destructive' });
                            }
                          }}
                        >
                          Gebruik deze locatie
                        </Button>
                      </li>
                    ))}
                    {item.kandidaten.length === 0 && (
                      <li className="text-xs text-muted-foreground italic">Geen PDOK-kandidaten gevonden.</li>
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
