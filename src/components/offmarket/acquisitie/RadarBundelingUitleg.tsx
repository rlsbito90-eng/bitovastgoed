import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bouwKandidatenVoorSignaal } from '@/lib/offMarket/acquisitie/bulkBrief';
import { CAMPAGNE_STAP_LABEL } from '@/lib/offMarket/brieven/groepering';
import { useRadarPartyCampaignContext, type RadarBriefCampaignContext } from '@/hooks/useRadarPartyCampaignContext';

interface Props {
  signaal: OffMarketSignaal;
  brieven: OffMarketBrief[];
  onOpenSignaal: (signaalId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  actief: 'Actief',
  warm: 'Warm contact',
  gepauzeerd: 'Gepauzeerd',
  afgerond_geen_reactie: 'Afgerond · geen reactie',
  afgesloten: 'Afgesloten',
};

function datumLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function contextScore(ctx: RadarBriefCampaignContext): number {
  return (ctx.campagneId ? 100 : 0) + (ctx.heeftEerderContact ? 20 : 0) + (ctx.primarySignaalId ? 10 : 0);
}

export default function RadarBundelingUitleg({ signaal, brieven, onOpenSignaal }: Props) {
  const partijContext = useRadarPartyCampaignContext([signaal]);
  if (partijContext.isLoading) return <p className="text-[11px] text-muted-foreground">Partij- en campagnecontext laden…</p>;
  if (partijContext.isError) return <p className="text-[11px] text-amber-900">Campagnecontext kon niet worden geladen. Open het signaal om de partijhistorie te controleren.</p>;

  const kandidaten = bouwKandidatenVoorSignaal(signaal, brieven.filter((b) => b.signaal_id === signaal.id));
  const matches = kandidaten.map((kandidaat) => ({
    kandidaat,
    partij: partijContext.resolveParty(kandidaat),
    context: partijContext.briefContext(kandidaat),
  })).filter((rij) => rij.partij.matchStatus === 'bevestigd');
  matches.sort((a, b) => contextScore(b.context) - contextScore(a.context));
  const match = matches[0];

  if (!match?.context.campagneId) {
    return (
      <div data-testid="acquisitie-bundeling-uitleg" className="rounded-md border border-amber-300/80 bg-amber-50/60 px-2.5 py-2 text-[11px] text-amber-950">
        <p className="font-semibold">Partijmatch gevonden, maar geen concrete actieve campagne gekoppeld.</p>
        <p className="mt-0.5">Beoordeel de partijhistorie voordat dit signaal als gebundeld wordt behandeld.</p>
      </div>
    );
  }

  const ctx = match.context;
  const partijNaam = ctx.partijNaam || match.kandidaat.bedrijfsnaam || match.kandidaat.naam || 'Onbekende partij';
  const status = ctx.campagneStatus ? (STATUS_LABEL[ctx.campagneStatus] ?? ctx.campagneStatus) : 'Onbekend';
  const stap = ctx.huidigeStap ? (CAMPAGNE_STAP_LABEL[ctx.huidigeStap] ?? ctx.huidigeStap) : 'geen briefstap';
  const laatsteContact = datumLabel(ctx.laatsteContactOp);

  return (
    <div data-testid="acquisitie-bundeling-uitleg" className="rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2 text-[11px]">
      <p className="font-semibold text-foreground">Gebundeld bij bestaande campagne</p>
      <p className="mt-0.5 text-foreground"><span className="font-medium">Partij:</span> {partijNaam}</p>
      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
        <span><span className="font-medium text-foreground">Status:</span> {status}</span>
        <span><span className="font-medium text-foreground">Stap:</span> {stap}</span>
        {laatsteContact && <span><span className="font-medium text-foreground">Laatste contact:</span> {laatsteContact}</span>}
      </div>
      {ctx.primaryObjectAdres && <p className="mt-0.5 text-muted-foreground"><span className="font-medium text-foreground">Hoofdobject:</span> {ctx.primaryObjectAdres}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5" data-no-row-select="true">
        {ctx.primarySignaalId && ctx.primarySignaalId !== signaal.id && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onOpenSignaal(ctx.primarySignaalId!)}>
            <ExternalLink className="h-3 w-3" />Open hoofdobject
          </Button>
        )}
        <span className="self-center font-mono-data text-[10px] text-muted-foreground" title="Interne campagne-ID">Campagne {ctx.campagneId.slice(0, 8)}…</span>
      </div>
    </div>
  );
}
