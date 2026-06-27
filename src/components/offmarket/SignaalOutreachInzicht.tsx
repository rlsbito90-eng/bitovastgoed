// Read-only "Outreach inzicht"-paneel voor één off-market signaal.
//
// Toont per signaal: header met briefstatus + readinessfase + telling,
// geadresseerden-overzicht (post/e-mail-progressie), korte tijdlijn met
// betrouwbaar gelogde brief-events en de eerstvolgende open opvolgtaak.
//
// Pure read-only weergave — geen mutaties, geen event-logging, geen
// state-updates in render. Alle aggregaten via useMemo.
import { useMemo } from 'react';
import { Mail, Inbox, Clock, CalendarClock, Users } from 'lucide-react';

import SignaalBriefStatusBadge from '@/components/offmarket/SignaalBriefStatusBadge';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';
import { useBriefEventsForSignaal, type BriefEvent } from '@/hooks/useBriefEvents';
import { useDataStore } from '@/hooks/useDataStore';
import {
  groepeerBrievenPerGeadresseerde, samenvatting,
  STAP_VOLGORDE, stapLabel,
  type GeadresseerdeGroep,
} from '@/lib/offMarket/brieven/groepering';
import { EMAIL_STAP_VOLGORDE } from '@/lib/offMarket/email/emailProfielen';
import { bepaalBriefStatus } from '@/lib/offMarket/briefStatus';
import { bepaalSignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import { formatDeadlineNL } from '@/lib/offMarket/volgendeActie';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

interface Props {
  signaal: OffMarketSignaal;
}

/** Betrouwbaar gelogde eventtypes (zie src/hooks/useOffMarketBrieven.tsx). */
const BETROUWBARE_EVENTS = new Set<BriefEvent['event_type']>([
  'concept_created',
  'posted',
  'sent',
  'follow_up_created',
  'archived',
]);

const EVENT_LABEL: Record<string, string> = {
  concept_created: 'Concept aangemaakt',
  posted: 'gepost',
  sent: 'verzonden',
  follow_up_created: 'Opvolging aangemaakt',
  archived: 'Concept gearchiveerd',
};

function formatKorteDatumNL(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

function dagenSinds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function geadresseerdeDisplay(g: GeadresseerdeGroep): string {
  return (g.bedrijfsnaam?.trim() || g.naam?.trim() || 'Onbekende geadresseerde');
}

/** Bepaal of een geadresseerde minstens één betrouwbare verzending heeft. */
function isBenaderd(g: GeadresseerdeGroep): boolean {
  for (const b of g.brieven) {
    if (b.archived_at) continue;
    if (b.status === 'verstuurd') return true;
    const vs = (b.verzendstatus ?? '') as string;
    if (vs === 'gepost' || vs === 'verzonden') return true;
    if (b.verzonden_op) return true;
  }
  return false;
}

/** Laatst verzonden brief van één geadresseerde. */
function laatsteVerzondenVoor(g: GeadresseerdeGroep): OffMarketBrief | null {
  let beste: OffMarketBrief | null = null;
  for (const b of g.brieven) {
    if (b.archived_at) continue;
    if (b.status !== 'verstuurd' || !b.verzonden_op) continue;
    if (!beste || (b.verzonden_op ?? '') > (beste.verzonden_op ?? '')) {
      beste = b;
    }
  }
  return beste;
}

/** Open opvolging-samenvatting voor één geadresseerde. */
function opvolgingTekst(g: GeadresseerdeGroep): string {
  // 1. Respons binnen?
  const respons = g.brieven.find(
    (b) => !b.archived_at && b.responsstatus && b.responsstatus !== 'geen_reactie',
  );
  if (respons) return 'Respons binnen';
  // 2. Open opvolgdatum uit brief.
  const vandaag = new Date().toISOString().slice(0, 10);
  const opv = g.brieven
    .filter((b) => !b.archived_at && b.opvolgdatum && (!b.responsstatus || b.responsstatus === 'geen_reactie'))
    .map((b) => b.opvolgdatum as string)
    .sort()
    .find(() => true);
  if (opv) {
    const teLaat = opv < vandaag;
    return `${teLaat ? 'Te laat sinds ' : 'Opvolgen op '}${formatDeadlineNL(opv)}`;
  }
  return '—';
}

function StapCel({ label, toon }: { label: string; toon: 'verstuurd' | 'concept' | 'geen' }) {
  const cls =
    toon === 'verstuurd' ? 'bg-success/10 text-success border-success/25'
    : toon === 'concept' ? 'bg-secondary/15 text-foreground border-secondary/30'
    : 'bg-muted/40 text-muted-foreground border-border/60';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${cls}`}
      data-testid={`stap-${label.toLowerCase().replace(/\s+/g, '-')}-${toon}`}
    >
      {label}: {toon === 'verstuurd' ? '✓' : toon === 'concept' ? '○' : '—'}
    </span>
  );
}

export default function SignaalOutreachInzicht({ signaal }: Props) {
  const { data: brieven = [] } = useOffMarketBrievenForSignaal(signaal.id);
  const { data: events = [] } = useBriefEventsForSignaal(signaal.id);
  const { taken } = useDataStore();

  const groepen = useMemo(
    () => groepeerBrievenPerGeadresseerde(brieven.filter((b) => !b.archived_at)),
    [brieven],
  );

  const briefStatus = useMemo(
    () => bepaalBriefStatus(brieven, taken ?? [], signaal.id),
    [brieven, taken, signaal.id],
  );

  const readiness = useMemo(
    () => bepaalSignaalReadiness({ signaal, brieven }),
    [signaal, brieven],
  );

  const benaderdCount = useMemo(
    () => groepen.reduce((acc, g) => acc + (isBenaderd(g) ? 1 : 0), 0),
    [groepen],
  );

  const sv = useMemo(
    () => samenvatting(groepen, taken ?? [], signaal.id),
    [groepen, taken, signaal.id],
  );

  // Brief-lookup voor event-rendering.
  const briefById = useMemo(() => {
    const m = new Map<string, OffMarketBrief>();
    for (const b of brieven) m.set(b.id, b);
    return m;
  }, [brieven]);

  const tijdlijn = useMemo(() => {
    const out: { id: string; datum: string; tekst: string }[] = [];
    for (const ev of events) {
      if (!BETROUWBARE_EVENTS.has(ev.event_type)) continue;
      const datum = formatKorteDatumNL(ev.event_date);
      const brief = ev.brief_id ? briefById.get(ev.brief_id) ?? null : null;
      const stap = brief?.campagne_stap ?? ev.campagne_stap ?? null;
      const stapTxt = stap ? stapLabel(stap) : '';

      // Geadresseerde-naam: alleen wanneer brief gevonden én naam/bedrijfsnaam aanwezig.
      let naam: string | null = null;
      if (brief) {
        naam = (brief.eigenaar_bedrijfsnaam?.trim() || brief.eigenaar_naam?.trim() || null);
      }

      let tekst: string;
      if (ev.event_type === 'follow_up_created') {
        tekst = 'Opvolging aangemaakt';
      } else if (ev.event_type === 'archived') {
        tekst = 'Concept gearchiveerd';
      } else if (ev.event_type === 'concept_created') {
        tekst = stapTxt
          ? `${stapTxt} concept aangemaakt${naam ? ` voor ${naam}` : ''}`
          : 'Concept aangemaakt';
      } else if (ev.event_type === 'posted' || ev.event_type === 'sent') {
        const actie = EVENT_LABEL[ev.event_type];
        if (stapTxt) {
          tekst = `${stapTxt} ${actie}${naam ? ` aan ${naam}` : ''}`;
        } else if (naam) {
          tekst = `Brief ${actie} aan ${naam}`;
        } else {
          // Onvoldoende context — neutraal tonen.
          tekst = 'Brief-event geregistreerd';
        }
      } else {
        tekst = 'Brief-event geregistreerd';
      }
      out.push({ id: ev.id, datum, tekst });
      if (out.length >= 6) break;
    }
    return out;
  }, [events, briefById]);

  return (
    <section
      data-testid="outreach-inzicht"
      className="section-card p-4 sm:p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Outreach inzicht
        </h2>
        <SignaalBriefStatusBadge status={briefStatus} />
        <span
          data-testid="outreach-readinessfase"
          className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border rounded-full bg-muted/40 text-muted-foreground border-border/60 whitespace-nowrap"
        >
          {readiness.info.label}
        </span>
        <span
          data-testid="outreach-telling"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
        >
          <Users className="h-3 w-3" />
          {groepen.length} geadresseerden, {benaderdCount} benaderd
        </span>
      </div>

      {/* Geadresseerden */}
      {groepen.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="outreach-geen-geadresseerden">
          Nog geen geadresseerden voor dit signaal.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="outreach-geadresseerden">
          {groepen.map((g, idx) => {
            const laatst = laatsteVerzondenVoor(g);
            const dgn = dagenSinds(laatst?.verzonden_op ?? null);
            return (
              <li
                key={g.key}
                data-testid={`outreach-geadresseerde-${idx}`}
                className="rounded-md border border-border/60 bg-card/50 p-2.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-foreground truncate">
                    {geadresseerdeDisplay(g)}
                  </span>
                  {isBenaderd(g) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded bg-success/10 text-success border-success/25">
                      benaderd
                    </span>
                  )}
                </div>

                {/* Post-progressie */}
                <div className="flex flex-wrap items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                  {STAP_VOLGORDE.map((stap, i) => {
                    const s = g.stappen[stap];
                    const toon: 'verstuurd' | 'concept' | 'geen' =
                      s.verstuurd ? 'verstuurd' : s.actiefConcept ? 'concept' : 'geen';
                    return <StapCel key={stap} label={`B${i + 1}`} toon={toon} />;
                  })}
                </div>

                {/* E-mail-progressie */}
                <div className="flex flex-wrap items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                  {EMAIL_STAP_VOLGORDE.map((stap, i) => {
                    const s = g.emailStappen[stap];
                    const toon: 'verstuurd' | 'concept' | 'geen' =
                      s.verstuurd ? 'verstuurd' : s.actiefConcept ? 'concept' : 'geen';
                    return <StapCel key={stap} label={`E${i + 1}`} toon={toon} />;
                  })}
                </div>

                {/* Laatst verzonden + opvolging */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {laatst?.verzonden_op
                      ? `Laatst verzonden: ${formatDeadlineNL(laatst.verzonden_op.slice(0, 10))}`
                      : 'Nog niets verzonden'}
                  </span>
                  {dgn != null && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3 w-3" />
                      {dgn} {dgn === 1 ? 'dag' : 'dagen'} geleden
                    </span>
                  )}
                  <span data-testid={`outreach-opvolging-${g.key}`}>
                    {opvolgingTekst(g)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Tijdlijn */}
      <div className="space-y-1.5" data-testid="outreach-tijdlijn">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Recente brief-events
        </p>
        {tijdlijn.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nog geen brief-events geregistreerd.</p>
        ) : (
          <ul className="space-y-1">
            {tijdlijn.map((t) => (
              <li
                key={t.id}
                className="text-[11px] text-foreground flex items-baseline gap-2"
              >
                <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                  {t.datum}
                </span>
                <span className="opacity-40">—</span>
                <span className="truncate">{t.tekst}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Eerstvolgende open opvolgtaak */}
      <div
        data-testid="outreach-eerstvolgende-taak"
        className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/40"
      >
        <CalendarClock className="h-3 w-3" />
        {sv.eerstvolgendeOpvolging ? (
          <span>
            Eerstvolgende open taak: <span className="text-foreground">{sv.eerstvolgendeOpvolging.titel}</span>
            {' '}— {formatDeadlineNL(sv.eerstvolgendeOpvolging.deadline)}
          </span>
        ) : (
          <span>Geen open opvolging</span>
        )}
      </div>
    </section>
  );
}
