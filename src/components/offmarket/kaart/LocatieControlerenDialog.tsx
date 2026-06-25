import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { GeocodeOnzeker } from '@/hooks/useKaartGeocoding';
import type { GeocodeKandidaat } from '@/lib/offMarket/kaart/geocode';
import { parseAdres, combineerParsed } from '@/lib/offMarket/kaart/geocode';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: GeocodeOnzeker[];
  onKies: (signaal_id: string, kandidaat: GeocodeKandidaat) => Promise<void>;
}

/**
 * Label voor de geselecteerde kandidaat:
 * - "Exacte toevoeging": signaal heeft toevoeging die exact matcht (uniek)
 * - "Beste": signaal zonder toevoeging, één basisadres
 * Anders geen label (handmatig kiezen).
 */
function besteKandidaatId(
  item: GeocodeOnzeker,
): { id: string | null; label: 'Exacte toevoeging' | 'Beste' | null } {
  const parsed = combineerParsed(parseAdres(item.adres), item.titel);
  if (parsed.toevoeging) {
    const exact = item.kandidaten.filter(k => k.toevoeging === parsed.toevoeging);
    if (exact.length === 1) return { id: exact[0].id, label: 'Exacte toevoeging' };
    return { id: null, label: null };
  }
  const zonder = item.kandidaten.filter(k => !k.toevoeging);
  if (zonder.length === 1) return { id: zonder[0].id, label: 'Beste' };
  return { id: null, label: null };
}

export default function LocatieControlerenDialog({ open, onOpenChange, items, onKies }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          p-0 gap-0 overflow-hidden bg-background flex flex-col
          w-[100vw] max-w-[100vw] h-[100dvh] max-h-[100dvh] rounded-none border-0
          sm:w-auto sm:max-w-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:border
          [&>button[type=button].absolute]:hidden
        "
      >
        {/* Sticky header met safe-area top + altijd zichtbare X rechtsboven */}
        <div
          className="shrink-0 border-b border-border bg-background flex items-start justify-between gap-3 px-4 sm:px-6"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: '0.75rem' }}
        >
          <div className="min-w-0 flex-1 text-left">
            <DialogTitle className="text-base sm:text-lg">Locatie controleren ({items.length})</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs sm:text-sm">
              PDOK heeft geen eenduidige match. Kies handmatig of laat het signaal staan.
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="Sluiten"
            className="shrink-0 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring h-11 w-11"
          >
            <X className="h-5 w-5" />
          </DialogClose>
        </div>

        {/* Scrollbare content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Geen onzekere locaties op dit moment.
            </p>
          )}
          <ul className="space-y-4">
            {items.map(item => {
              const beste = besteKandidaatId(item);
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
                  {import.meta.env.DEV && item.debug && (
                    <details className="mb-2 rounded border border-border/60 bg-background p-2 text-[10px] text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">Debug locatie</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono">
                        {JSON.stringify(item.debug, null, 2)}
                      </pre>
                    </details>
                  )}
                  <ul className="space-y-2">
                    {item.kandidaten.map(k => (
                      <li
                        key={k.id}
                        className="flex flex-col gap-2 rounded border border-border/60 p-2.5 bg-background"
                      >
                        <div className="min-w-0">
                          <div className="text-sm break-words flex flex-wrap items-center gap-1.5">
                            {beste.id === k.id && beste.label && (
                              <Badge variant="secondary" className="text-[10px]">{beste.label}</Badge>
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
                          variant={beste.id === k.id ? 'default' : 'outline'}
                          className="w-full min-h-[44px]"
                          onClick={async () => {
                            try {
                              await onKies(item.signaal_id, k);
                              toast.success('Locatie opgeslagen via PDOK', { description: k.weergavenaam });
                            } catch {
                              toast.error('Opslaan mislukt');
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
