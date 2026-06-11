import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { OffMarketPriorityBadge, OffMarketStatusBadge } from '@/components/offmarket/OffMarketBadges';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signalen: OffMarketSignaal[];
  onZoek: (s: OffMarketSignaal) => Promise<void>;
}

export default function ZonderLocatieDialog({ open, onOpenChange, signalen, onZoek }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Signalen zonder locatie ({signalen.length})</DialogTitle>
          <DialogDescription>
            Deze signalen kunnen niet op de kaart worden getoond omdat coördinaten ontbreken
            en PDOK geen betrouwbare match heeft gevonden.
          </DialogDescription>
        </DialogHeader>
        {signalen.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Geen signalen zonder locatie.</p>
        )}
        <ul className="divide-y divide-border">
          {signalen.map(s => (
            <li key={s.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{s.titel}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[s.adres, [s.postcode, s.plaats].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '— geen adres —'}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <OffMarketPriorityBadge prioriteit={s.prioriteit} />
                  <OffMarketStatusBadge status={s.status} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await onZoek(s);
                      toast({ title: 'PDOK gezocht', description: 'Bekijk eventuele kandidaten.' });
                    } catch {
                      toast({ title: 'Zoeken mislukt', variant: 'destructive' });
                    }
                  }}
                  disabled={!s.adres && !s.postcode}
                >
                  <Search className="h-3.5 w-3.5" /> Zoek via PDOK
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { onOpenChange(false); navigate(`/off-market/${s.id}`); }}>
                  Open signaal
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
