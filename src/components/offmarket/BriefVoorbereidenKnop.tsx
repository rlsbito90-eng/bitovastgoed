// Knop "Brief voorbereiden" voor in de Eigenaarsonderzoek-sectie van een
// Off-Market signaal. Disabled met tooltip wanneer eigenaar/rechthebbende
// of objectadres ontbreekt.
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useKadasterDataRecordsForSignaal } from '@/hooks/useKadasterDataRecords';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';
import { kanBriefVoorbereiden } from '@/lib/offMarket/brief';
import BriefVoorbereidenDialog from '@/components/offmarket/BriefVoorbereidenDialog';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  /** Wanneer gezet: open exact deze bestaande brief, geen nieuw concept aanmaken. */
  initialBrief?: import('@/hooks/useOffMarketBrieven').OffMarketBrief | null;
  /** Forceer een geadresseerde-label (alleen wanneer initialBrief leeg is). */
  forceKandidaatLabel?: string | null;
  /** Controlled open-state (optioneel). */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** Verberg de trigger-knop (handig bij externe trigger). */
  hideButton?: boolean;
}

export default function BriefVoorbereidenKnop({
  signaal,
  initialBrief = null,
  forceKandidaatLabel = null,
  open: openProp,
  onOpenChange,
  hideButton = false,
}: Props) {
  const { data: records = [] } = useKadasterDataRecordsForSignaal(signaal.id);
  const { data: brieven = [] } = useOffMarketBrievenForSignaal(signaal.id);
  const [openInner, setOpenInner] = useState(false);
  const isControlled = typeof openProp === 'boolean';
  const open = isControlled ? !!openProp : openInner;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenInner(v);
    onOpenChange?.(v);
  };
  const { ok, reden } = kanBriefVoorbereiden(signaal, records);

  return (
    <>
      {!hideButton && (
        <button
          type="button"
          data-testid="brief-voorbereiden-knop"
          onClick={() => ok && setOpen(true)}
          disabled={!ok}
          title={ok ? 'Brief voorbereiden' : reden ?? 'Brief voorbereiden niet beschikbaar'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" />
          Brief voorbereiden
        </button>
      )}
      {open && (
        <BriefVoorbereidenDialog
          open={open}
          onOpenChange={setOpen}
          signaal={signaal}
          kadasterRecords={records}
          historischeBrieven={brieven}
          initialBrief={initialBrief}
          forceKandidaatLabel={forceKandidaatLabel}
        />
      )}
    </>
  );
}
