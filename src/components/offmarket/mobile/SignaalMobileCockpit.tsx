// Compacte mobiele samenvatting voor signaaldetail.
// Vervangt op mobiel zowel SignaalKpiBar als SignaalCockpit. Geen horizontale
// scroll, geen afgekapte teksten, rustige hiërarchie.
// V31 — uitgebreid met BAG-status, Kadasteradvies (alleen bij verrijkt),
// compacte StatusWijzigDropdown en taakacties. Geen nieuwe queries.
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowUpRight, ListPlus, ListChecks } from 'lucide-react';
import {
  OffMarketEigenaarstatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import SignaalBriefStatusBadge from '@/components/offmarket/SignaalBriefStatusBadge';
import StatusWijzigDropdown from '@/components/offmarket/overzicht/StatusWijzigDropdown';
import { BagKaartBadge } from '@/components/offmarket/kaart/KaartSignaalBadges';
import KadasteradviesBadge from '@/components/offmarket/bag/KadasteradviesBadge';
import {
  ASSETTYPE_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';
import { formatGebiedsindeling } from '@/lib/offMarket/geo';
import { bepaalVolgendeActie, formatDeadlineNL } from '@/lib/offMarket/volgendeActie';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';
import { useDataStore } from '@/hooks/useDataStore';
import type { BriefStatus } from '@/lib/offMarket/briefStatus';
import type { Taak } from '@/data/mock-data';

interface Props {
  signaal: OffMarketSignaal;
  taken: Taak[];
  briefStatus: BriefStatus;
  onTaakAanmaken?: () => void;
  onOpenTaken?: () => void;
}

const OPEN_STATUSSEN = new Set(['open', 'in_uitvoering', 'wacht_op_reactie']);

export default function SignaalMobileCockpit({
  signaal, taken, briefStatus, onTaakAanmaken, onOpenTaken,
}: Props) {
  const { getRelatieById } = useDataStore();
  const va = bepaalVolgendeActie(signaal, taken, signaal.id);
  const eigenaarstatus = (signaal as any).eigenaarstatus ?? 'onbekend';
  const eigenaarNaam = (signaal as any).eigenaar_naam ?? null;
  const relatieId = (signaal as any).eigenaar_relatie_id as string | null | undefined;
  const relatie = relatieId ? getRelatieById(relatieId) : null;

  const [strategieOpen, setStrategieOpen] = useState(false);

  const aiScore = typeof signaal.ai_score === 'number' ? String(signaal.ai_score) : '—';
  const verkoopkans = typeof signaal.ai_verkoopkans === 'number'
    ? `${Math.round(Number(signaal.ai_verkoopkans) * 100)}%`
    : '—';
  const strategieRuw = (signaal.potentiele_strategie || signaal.ai_strategie_suggestie || '').trim();
  const strategieLang = strategieRuw.length > 90;
  const gebied = formatGebiedsindeling(signaal as any);

  const bagStatus =
    ((signaal as unknown as { bag_status?: string | null }).bag_status as string | null | undefined) ?? 'niet_verrijkt';
  const bagVerrijkt = bagStatus === 'verrijkt';
  const advies = berekenKadasteradvies(signaal as unknown as SignaalBagInput);

  const heeftOpenTaken = taken.some(
    (t) => t.offMarketSignaalId === signaal.id && OPEN_STATUSSEN.has(t.status) && !t.softDeletedAt,
  );

  return (
    <section
      data-testid="signaal-mobile-cockpit"
      className="section-card p-3.5 space-y-2.5"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Cel label="AI-score" waarde={aiScore} accent />
        <Cel label="Verkoopkans" waarde={verkoopkans} accent />
        <Cel label="Assettype" waarde={ASSETTYPE_LABEL[signaal.assettype]} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Strategie
          </p>
          {strategieRuw ? (
            <>
              <p
                className={`text-[13.5px] font-medium text-foreground mt-0.5 leading-snug break-words ${
                  strategieLang && !strategieOpen ? 'line-clamp-2' : ''
                }`}
              >
                {strategieRuw}
              </p>
              {strategieLang && (
                <button
                  type="button"
                  onClick={() => setStrategieOpen((v) => !v)}
                  className="mt-1 text-[11px] text-accent hover:underline"
                >
                  {strategieOpen ? 'Minder tonen' : 'Meer tonen'}
                </button>
              )}
            </>
          ) : (
            <p className="text-[13.5px] font-medium text-muted-foreground mt-0.5">Nog te bepalen</p>
          )}
        </div>
      </div>

      {/* BAG / Kadaster-samenvatting */}
      <div
        data-testid="mobile-cockpit-bag-rij"
        className="flex flex-wrap items-center gap-1.5 pt-0.5"
      >
        <BagKaartBadge signaal={{ bag_status: bagStatus as any, kadasteradvies: null }} size="sm" />
        {bagVerrijkt && (
          <KadasteradviesBadge niveau={advies.niveau} size="sm" />
        )}
      </div>

      <hr className="border-border/60" />

      <Rij label="Status">
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          <StatusWijzigDropdown signaal={signaal} variant="compact" />
        </div>
      </Rij>
      <Rij label="Eigenaar">
        <div className="flex items-center gap-1.5 min-w-0 justify-end flex-wrap">
          <OffMarketEigenaarstatusBadge status={eigenaarstatus} />
          {eigenaarNaam && (
            <span className="text-[11px] text-muted-foreground break-words max-w-[150px] text-right">
              {eigenaarNaam}
            </span>
          )}
        </div>
      </Rij>
      <Rij label="Brief">
        <SignaalBriefStatusBadge status={briefStatus} />
      </Rij>
      {relatie && (
        <Rij label="Relatie">
          <Link
            to={`/relaties/${relatie.id}`}
            className="text-[12px] text-accent hover:underline inline-flex items-center gap-1 break-words max-w-[180px]"
          >
            <span className="break-words text-right">
              {relatie.bedrijfsnaam || relatie.contactpersoon || 'Relatie'}
            </span>
            <ArrowUpRight className="h-3 w-3 shrink-0" />
          </Link>
        </Rij>
      )}
      <Rij label="Gebied">
        <span className="text-[12px] text-foreground text-right break-words leading-snug">
          {gebied}
        </span>
      </Rij>

      <hr className="border-border/60" />

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Volgende actie
        </p>
        {va ? (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-foreground leading-snug break-words flex-1">
              {va.titel}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {formatDeadlineNL(va.deadline)}
            </span>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">Geen open taak gepland.</p>
        )}
      </div>

      {(onTaakAanmaken || (heeftOpenTaken && onOpenTaken)) && (
        <div className="flex flex-wrap gap-1.5 pt-1" data-testid="mobile-cockpit-taakacties">
          {onTaakAanmaken && (
            <button
              type="button"
              onClick={onTaakAanmaken}
              data-testid="mobile-cockpit-taak-aanmaken"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-card text-[12px] text-foreground hover:border-accent/50 hover:text-accent"
            >
              <ListPlus className="h-3.5 w-3.5" />
              Taak aanmaken
            </button>
          )}
          {heeftOpenTaken && onOpenTaken && (
            <button
              type="button"
              onClick={onOpenTaken}
              data-testid="mobile-cockpit-open-taken"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-card text-[12px] text-foreground hover:border-accent/50 hover:text-accent"
            >
              <ListChecks className="h-3.5 w-3.5" />
              Open taken
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Cel({ label, waarde, accent, clamp, title }: { label: string; waarde: string; accent?: boolean; clamp?: boolean; title?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p
        className={`text-[14px] font-semibold mt-0.5 leading-tight ${
          clamp ? 'line-clamp-1' : 'break-words'
        } ${accent ? 'text-accent' : 'text-foreground'}`}
        title={title ?? waarde}
      >
        {waarde}
      </p>
    </div>
  );
}

function Rij({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 flex-1 flex justify-end">{children}</div>
    </div>
  );
}
