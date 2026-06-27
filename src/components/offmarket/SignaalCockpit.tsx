// Rechter Signaalcockpit (sticky desktop, compacte kaart mobiel).
// Bundelt status/prioriteit, AI, classificatie, eigenaar/CRM, briefstatus,
// volgende actie en quick actions in één plek — vergelijkbaar met de
// Aanbod/Deal Cockpit.
import { Link } from 'react-router-dom';
import {
  Sparkles, MapPin, MapIcon, Landmark, Mail, ListPlus, FileSearch,
  ArrowUpRight, ZapIcon, Pencil,
} from 'lucide-react';
// Button is niet meer nodig — VolgendeActiesBlok rendert eigen knoppen.
import {
  OffMarketStatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import SignaalBriefStatusBadge from '@/components/offmarket/SignaalBriefStatusBadge';
import {
  bouwBagViewerUrl, bouwGoogleMapsUrl, bouwKadastraleKaartUrl,
} from '@/lib/offMarket/onderzoeksAdres';
import { ASSETTYPE_LABEL, type OffMarketSignaal } from '@/lib/offMarket/types';
import { formatGebiedsindeling } from '@/lib/offMarket/geo';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';
import VolgendeActiesBlok from '@/components/offmarket/cockpit/VolgendeActiesBlok';
import StatusWijzigDropdown from '@/components/offmarket/overzicht/StatusWijzigDropdown';
import PrioriteitWijzigDropdown from '@/components/offmarket/cockpit/PrioriteitWijzigDropdown';
import EigenaarstatusWijzigDropdown from '@/components/offmarket/cockpit/EigenaarstatusWijzigDropdown';
import ToevoegenAanAcquisitieSelectieKnop from '@/components/offmarket/acquisitie/ToevoegenAanAcquisitieSelectieKnop';
import type { BriefStatus } from '@/lib/offMarket/briefStatus';
import type { OffMarketEigenaarstatus } from '@/lib/offMarket/types';
import type { Taak } from '@/data/mock-data';

interface Props {
  signaal: OffMarketSignaal;
  taken: Taak[];
  briefStatus: BriefStatus;
  /** Callback voor "Verrijk met AI" — open AI-flow in Overzicht-tab. */
  onAiVerrijken?: () => void;
  /** Callback voor "Kadaster ophalen" — open KadasterCheckDialog. */
  onKadasterOphalen?: () => void;
  /** Callback voor "Brief voorbereiden" — open BriefVoorbereidenDialog. */
  onBriefVoorbereiden?: () => void;
  /** Callback voor "Taak aanmaken". */
  onTaakAanmaken?: () => void;
  /** Optioneel: open volledige bewerk-dialog. */
  onBewerken?: () => void;
  /** Optioneel: navigeer naar tab "Taken & tijdlijn". */
  onOpenTaken?: () => void;
}

export default function SignaalCockpit({
  signaal, taken, briefStatus,
  onAiVerrijken, onKadasterOphalen, onBriefVoorbereiden, onTaakAanmaken, onBewerken,
  onOpenTaken,
}: Props) {
  const { getRelatieById } = useDataStore();
  const { data: brieven = [] } = useOffMarketBrievenForSignaal(signaal.id);
  // VolgendeActiesBlok vervangt de oude bepaalVolgendeActie-call.
  const eigenaarstatus: OffMarketEigenaarstatus =
    ((signaal as any).eigenaarstatus as OffMarketEigenaarstatus | null | undefined) ?? 'onbekend';
  const eigenaarNaam = (signaal as any).eigenaar_naam ?? null;
  const relatieId = (signaal as any).eigenaar_relatie_id as string | null | undefined;
  const relatie = relatieId ? getRelatieById(relatieId) : null;

  const mapsUrl = bouwGoogleMapsUrl({
    adres: signaal.adres, postcode: signaal.postcode, plaats: signaal.plaats,
    lat: (signaal as any).lat ?? null, lng: (signaal as any).lng ?? null,
  });

  const verkoopkans = typeof signaal.ai_verkoopkans === 'number'
    ? `${Math.round(Number(signaal.ai_verkoopkans) * 100)}%` : '—';

  return (
    <aside data-testid="signaal-cockpit" className="space-y-4">
      {/* Cockpit-kaart */}
      <div className="section-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Signaal-Cockpit
          </h3>
          {onBewerken && (
            <button type="button" onClick={onBewerken} className="text-muted-foreground hover:text-foreground" aria-label="Bewerken">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Row label="Status">
          <div className="flex items-center gap-1.5">
            <OffMarketStatusBadge status={signaal.status} />
            <StatusWijzigDropdown signaal={signaal} variant="compact" />
          </div>
        </Row>
        <Row label="Prioriteit">
          <PrioriteitWijzigDropdown signaalId={signaal.id} prioriteit={signaal.prioriteit} />
        </Row>
        <Row label="AI-score">
          <span className="text-sm font-medium text-foreground">{typeof signaal.ai_score === 'number' ? signaal.ai_score : '—'}</span>
        </Row>
        <Row label="Verkoopkans">
          <span className="text-sm font-medium text-foreground">{verkoopkans}</span>
        </Row>
        <Row label="Assettype">
          <span className="text-sm text-foreground truncate">{ASSETTYPE_LABEL[signaal.assettype]}</span>
        </Row>
        <Row label="Strategie">
          <span
            className="text-sm text-foreground break-words"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            title={signaal.potentiele_strategie ?? undefined}
          >
            {signaal.potentiele_strategie || '—'}
          </span>
        </Row>
        <Row label="Eigenaar">
          <div className="flex items-center gap-2 min-w-0 justify-end">
            {eigenaarNaam && <span className="text-xs text-muted-foreground truncate">{eigenaarNaam}</span>}
            <EigenaarstatusWijzigDropdown signaalId={signaal.id} eigenaarstatus={eigenaarstatus} />
          </div>
        </Row>
        <Row label="CRM-relatie">
          {relatie ? (
            <Link to={`/relaties/${relatie.id}`} className="text-sm text-accent hover:underline inline-flex items-center gap-1 truncate">
              <span className="truncate">{relatie.bedrijfsnaam || relatie.contactpersoon || 'Relatie'}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Nog niet gekoppeld</span>
          )}
        </Row>
        <Row label="Briefstatus">
          <button
            type="button"
            data-testid="briefstatus-scroll-knop"
            onClick={() => {
              try {
                document.getElementById('brieven-sectie')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } catch { /* no-op */ }
            }}
            className="hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            aria-label="Naar brieven-sectie"
          >
            <SignaalBriefStatusBadge status={briefStatus} />
          </button>
        </Row>
        <Row label="Gebied">
          <span className="text-xs text-foreground truncate">{formatGebiedsindeling(signaal as any)}</span>
        </Row>

        {/* Acquisitieselectie-toggle — binnen cockpitkaart, met subtiele divider. */}
        <div className="pt-3 mt-1 border-t border-border/60">
          <ToevoegenAanAcquisitieSelectieKnop
            signaalId={signaal.id}
            variant="default"
            labelMode="long"
            className="w-full justify-center"
          />
        </div>
      </div>


      {/* Volgende acties — toont meerdere open opvolgingen */}
      <VolgendeActiesBlok
        signaalId={signaal.id}
        taken={taken}
        brieven={brieven}
        onAllesBekijken={onOpenTaken}
      />

      {/* Quick actions */}
      <div className="section-card p-2 sm:p-3">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 pt-1 pb-2">
          Quick actions
        </h3>
        <ul className="space-y-0.5">
          <QuickAction icon={Sparkles} label="AI verrijken" onClick={onAiVerrijken} />
          {mapsUrl && <QuickActionLink icon={MapPin} label="Google Maps" href={mapsUrl} />}
          <QuickActionLink icon={MapIcon} label="BAG Viewer" href={bouwBagViewerUrl()} />
          <QuickActionLink icon={Landmark} label="KadastraleKaart" href={bouwKadastraleKaartUrl()} />
          <QuickAction
            icon={FileSearch}
            label="Kadaster ophalen"
            onClick={onKadasterOphalen}
            disabled={(signaal as unknown as { bag_status?: string | null }).bag_status !== 'verrijkt'}
            disabledReden="Kies eerst een geldige BAG-match."
          />
          <QuickAction icon={Mail} label="Brief voorbereiden" onClick={onBriefVoorbereiden} />
          <QuickAction icon={ListPlus} label="Taak aanmaken" onClick={onTaakAanmaken} />
        </ul>

      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 flex-1 flex justify-end text-right">{children}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  disabled: disabledProp,
  disabledReden,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReden?: string;
}) {
  const disabled = disabledProp || !onClick;
  return (
    <li>
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-disabled={disabled}
        title={disabled && disabledReden ? disabledReden : undefined}
        className="w-full flex items-center justify-between gap-2 px-2 py-2 text-sm rounded-md hover:bg-muted text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </li>
  );
}


function QuickActionLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  return (
    <li>
      <a
        href={href} target="_blank" rel="noopener noreferrer"
        className="w-full flex items-center justify-between gap-2 px-2 py-2 text-sm rounded-md hover:bg-muted text-foreground"
      >
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
      </a>
    </li>
  );
}
