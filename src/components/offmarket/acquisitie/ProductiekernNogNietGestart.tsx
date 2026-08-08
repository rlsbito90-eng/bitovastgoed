import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { ProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';

export interface ProductiekernNietGestarteSelectie {
  selectieId: string;
  signaalId: string;
  label: string;
}

interface ProductiekernNogNietGestartProps {
  items: readonly ProductiekernNietGestarteSelectie[];
  writeSamenstelling: ProductiekernBrowserWriteSamenstelling;
}

function operationKey(selectieId: string): string {
  const uniek = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `acquisitie:start-verwerking:${selectieId}:${uniek}`;
}

/**
 * Expliciete startlijst voor selecties waarvoor nog geen formeel
 * acquisitiedossier bestaat.
 *
 * Ontbrekend dossier wordt bewust niet als formele werkbak `nieuwe_selectie`
 * gepresenteerd. De gebruiker kan de verwerking hier expliciet starten; de
 * transactionele RPC maakt dan het dossier aan en zet het op
 * `eigenaar_achterhalen`.
 */
export default function ProductiekernNogNietGestart({
  items,
  writeSamenstelling,
}: ProductiekernNogNietGestartProps) {
  const queryClient = useQueryClient();

  const startMutatie = useMutation({
    mutationFn: async (item: ProductiekernNietGestarteSelectie) => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw new Error(error.message);
      const actorId = data.user?.id;
      if (!actorId) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');

      return writeSamenstelling.vroegeRepository.startVerwerking({
        selectieId: item.selectieId,
        actorId,
        operationKey: operationKey(item.selectieId),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['off-market-acquisitie-productiekern', 'dossiers'],
      });
      toast.success('Verwerking gestart', {
        description: 'Het dossier staat nu bij Eigenaar achterhalen.',
      });
    },
    onError: (err) => {
      toast.error('Verwerking starten mislukt', {
        description: err instanceof Error ? err.message : 'Onbekende fout',
      });
    },
  });

  if (items.length === 0) return null;

  return (
    <section
      className="space-y-2 rounded-lg border bg-card px-4 py-3"
      data-testid="productiekern-nog-niet-gestart"
      aria-label="Nog niet gestarte acquisitieselecties"
    >
      <div>
        <p className="text-sm font-medium">Nog niet gestart ({items.length})</p>
        <p className="text-xs text-muted-foreground">
          Deze selecties hebben nog geen formeel Productiekern-dossier. Start de verwerking om ze naar Eigenaar achterhalen te brengen.
        </p>
      </div>

      <ul className="divide-y divide-border/70">
        {items.map((item) => {
          const bezig = startMutatie.isPending
            && startMutatie.variables?.selectieId === item.selectieId;
          return (
            <li key={item.selectieId} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-sm">{item.label}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!writeSamenstelling.activatie.schrijvenActief || startMutatie.isPending}
                onClick={() => startMutatie.mutate(item)}
                data-testid={`productiekern-start-verwerking-${item.selectieId}`}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {bezig ? 'Starten…' : 'Start verwerking'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
