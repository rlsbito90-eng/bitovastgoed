// Rechter Signaalcockpit (sticky desktop, compacte kaart mobiel).
// Bundelt status/prioriteit, AI, classificatie, eigenaar/CRM, briefstatus,
// volgende actie en quick actions in één plek — vergelijkbaar met de
// Aanbod/Deal Cockpit.
import { Link } from 'react-router-dom';
import {
  Sparkles, MapPin, MapIcon, Landmark, Mail, ListPlus, FileSearch,
  ArrowUpRight, ZapIcon, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  OffMarketPriorityBadge, OffMarketStatusBadge, OffMarketEigenaarstatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import SignaalBriefStatusBadge from '@/components/offmarket/SignaalBriefStatusBadge';
import { bepaalVolgendeActie, formatDeadlineNL } from '@/lib/offMarket/volgendeActie';
import {
  bouwBagViewerUrl, bouwGoogleMapsUrl, bouwKadastraleKaartUrl,
} from '@/lib/offMarket/onderzoeksAdres';
import { ASSETTYPE_LABEL, type OffMarketSignaal } from '@/lib/offMarket/types';
import { useDataStore } from '@/hooks/useDataStore';
import type { BriefStatus } from '@/lib/offMarket/briefStatus';
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
}

export default function SignaalCockpit({
  signaal, taken, briefStatus,
  onAiVerrijken, onKadasterOphalen, onBriefVoorbereiden, onTaakAanmaken, onBewerken,
}: Props) {
  const { getRelatieById } = useDataStore();
  const va = bepaalVolgendeActie(signaal, taken, signaal.id);
  const eigenaarstatus = (signaal as any).eigenaarstatus ?? 'onbekend';
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
        <Row label="Status"><OffMarketStatusBadge status={signaal.status} /></Row>
        <Row label="Prioriteit"><OffMarketPriorityBadge prioriteit={signaal.prioriteit} /></Row>
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
          <span className="text-sm text-foreground truncate">{signaal.potentiele_strategie || '—'}</span>
        </Row>
        <Row label="Eigenaar">
          <div className="flex items-center gap-2 min-w-0">
            <OffMarketEigenaarstatusBadge status={eigenaarstatus} />
            {eigenaarNaam && <span className="text-xs text-muted-foreground truncate">{eigenaarNaam}</span>}
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
        <Row label="Briefstatus"><SignaalBriefStatusBadge status={briefStatus} /></Row>
      </div>

      {/* Next action */}
      <div className="section-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Volgende actie
          </h3>
          {va && (
            <span className="text-[10px] uppercase tracking-wider text-accent">
              {va.bron === 'taak' ? 'Open taak' : 'Gepland'}
            </span>
          )}
        </div>
        {va ? (
          <>
            <p className="text-sm font-medium text-foreground leading-tight">{va.titel}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatDeadlineNL(va.deadline)}</p>
            {va.bron === 'taak' && va.taakId && (
              <Button asChild size="sm" className="w-full mt-2">
                <Link to={`/taken/${va.taakId}`}>Open taak</Link>
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Geen open taak gepland.</p>
        )}
      </div>

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
          <QuickAction icon={FileSearch} label="Kadaster ophalen" onClick={onKadasterOphalen} />
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

function QuickAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
  const disabled = !onClick;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
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
