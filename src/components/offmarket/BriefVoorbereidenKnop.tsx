// Knop "Brief voorbereiden" voor in de Eigenaarsonderzoek-sectie van een
// Off-Market signaal. Nieuwe koude post mag alleen starten wanneer de
// partij/campagnerouter bevestigt dat dit werkelijk het eerste contact is.
import { lazy, Suspense, useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useKadasterDataRecordsForSignaal } from '@/hooks/useKadasterDataRecords';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';
import { useRadarPartyCampaignContext } from '@/hooks/useRadarPartyCampaignContext';
import { kanBriefVoorbereiden } from '@/lib/offMarket/brief';
import { bouwKandidatenVoorSignaal } from '@/lib/offMarket/acquisitie/bulkBrief';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const BriefVoorbereidenDialog = lazy(
  () => import('@/components/offmarket/BriefVoorbereidenDialog'),
);

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
  const partyContext = useRadarPartyCampaignContext([signaal]);
  const [openInner, setOpenInner] = useState(false);
  const isControlled = typeof openProp === 'boolean';
  const open = isControlled ? !!openProp : openInner;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenInner(v);
    onOpenChange?.(v);
  };
  const { ok, reden } = kanBriefVoorbereiden(signaal, records);

  const kandidaten = useMemo(
    () => bouwKandidatenVoorSignaal(signaal, brieven),
    [signaal, brieven],
  );

  const campagneBlokkade = useMemo((): string | null => {
    // Een bestaand record openen/bewerken blijft altijd mogelijk. De router
    // bewaakt alleen het starten van een nieuw koud contact.
    if (initialBrief) return null;
    if (partyContext.isLoading) return 'Partij- en campagnehistorie wordt gecontroleerd.';
    if (partyContext.isError) {
      return 'Partij- en campagnehistorie kon niet betrouwbaar worden gecontroleerd. Start daarom geen nieuwe koude brief vanuit deze losse route.';
    }
    if (kandidaten.length > 1) {
      return 'Meerdere geadresseerden/rechthebbenden gevonden. Gebruik Radar-brieven zodat iedere partij afzonderlijk en auditbaar wordt gerouteerd.';
    }
    if (kandidaten.length === 0) return null;

    const routing = partyContext.route(signaal, kandidaten[0]);
    if (
      routing.outcome === 'nieuwe_campagne_brief_1'
      && routing.geadviseerdeStap === 'brief_1'
      && routing.magAutomatischBriefMaken
    ) {
      return null;
    }

    return `${routing.reden} Gebruik Radar-brieven om de bestaande campagne, juiste vervolgstap of context te verwerken.`;
  }, [initialBrief, partyContext, kandidaten, signaal]);

  const triggerDisabled = !ok || (!initialBrief && partyContext.isLoading);
  const triggerTitle = !ok
    ? (reden ?? 'Brief voorbereiden niet beschikbaar')
    : campagneBlokkade ?? 'Brief voorbereiden';

  const openNieuweBrief = () => {
    if (!ok) return;
    if (campagneBlokkade) {
      toast.warning(campagneBlokkade);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {!hideButton && (
        <button
          type="button"
          data-testid="brief-voorbereiden-knop"
          onClick={openNieuweBrief}
          disabled={triggerDisabled}
          title={triggerTitle}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-card text-foreground border-border hover:border-accent/50 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" />
          Brief voorbereiden
        </button>
      )}
      {open && (
        <Suspense fallback={null}>
          <BriefVoorbereidenDialog
            open={open}
            onOpenChange={setOpen}
            signaal={signaal}
            kadasterRecords={records}
            historischeBrieven={brieven}
            initialBrief={initialBrief}
            forceKandidaatLabel={forceKandidaatLabel}
          />
        </Suspense>
      )}
    </>
  );
}
