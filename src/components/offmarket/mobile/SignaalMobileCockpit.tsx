// Compacte mobiele samenvatting voor signaaldetail.
// Vervangt op mobiel zowel SignaalKpiBar als SignaalCockpit. Geen horizontale
// scroll, geen afgekapte teksten, rustige hiërarchie.
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  OffMarketEigenaarstatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import SignaalBriefStatusBadge from '@/components/offmarket/SignaalBriefStatusBadge';
import {
  ASSETTYPE_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';
import { formatGebiedsindeling } from '@/lib/offMarket/geo';
import { bepaalVolgendeActie, formatDeadlineNL } from '@/lib/offMarket/volgendeActie';
import { useDataStore } from '@/hooks/useDataStore';
import type { BriefStatus } from '@/lib/offMarket/briefStatus';
import type { Taak } from '@/data/mock-data';

interface Props {
  signaal: OffMarketSignaal;
  taken: Taak[];
  briefStatus: BriefStatus;
}

export default function SignaalMobileCockpit({ signaal, taken, briefStatus }: Props) {
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


      <hr className="border-border/60" />

      <Rij label="Eigenaar">
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          <OffMarketEigenaarstatusBadge status={eigenaarstatus} />
          {eigenaarNaam && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
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
            className="text-[12px] text-accent hover:underline inline-flex items-center gap-1 truncate max-w-[180px]"
          >
            <span className="truncate">
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

// Korte, scanbare strategie-label. Lange AI-strategie wordt teruggebracht naar
// een paar woorden voor in de cockpit. Volledige tekst blijft in AI-analyse.
function korteStrategie(ruw: string): string {
  const t = ruw.trim();
  if (!t) return 'Nog te bepalen';
  // pak deel voor eerste leesteken / dubbelepunt
  const eerste = t.split(/[:.\n;–—]/)[0].trim();
  const kort = eerste.length > 0 ? eerste : t;
  // max ~40 tekens
  if (kort.length <= 40) return kort;
  return kort.slice(0, 38).trimEnd() + '…';
}

function Rij({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 flex-1 flex justify-end">{children}</div>
    </div>
  );
}
