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
      <DialogContent
        className="
          p-0 gap-0 overflow-hidden bg-background
          w-[100vw] max-w-[100vw] h-[100vh] max-h-[100vh] rounded-none border-0
          sm:w-auto sm:max-w-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:border
        "
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-border sticky top-0 bg-background z-10 text-left">
          <DialogTitle>Signalen zonder locatie ({signalen.length})</DialogTitle>
          <DialogDescription>
            Deze signalen kunnen niet op de kaart worden getoond omdat coördinaten ontbreken
            en PDOK geen betrouwbare match heeft gevonden.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
          {signalen.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">Geen signalen zonder locatie.</p>
          )}
          <ul className="divide-y divide-border">
            {signalen.map(s => (
              <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm break-words">{s.titel}</div>
                  <div className="text-xs text-muted-foreground break-words">
                    {[s.adres, [s.postcode, s.plaats].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '— geen adres —'}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <OffMarketPriorityBadge prioriteit={s.prioriteit} />
                    <OffMarketStatusBadge status={s.status} />
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 sm:flex-none min-h-[40px]"
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
                    <Search className="h-3.5 w-3.5 mr-1" /> Zoek via PDOK
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 sm:flex-none min-h-[40px]"
                    onClick={() => { onOpenChange(false); navigate(`/off-market/${s.id}`); }}
                  >
                    Open signaal
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
