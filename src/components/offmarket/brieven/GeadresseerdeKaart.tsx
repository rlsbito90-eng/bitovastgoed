// Kaart per geadresseerde binnen Brieven & opvolging.
// Toont Brief 1 / 2 / 3 als rijen met statusbadge, datum, verzendstatus,
// postdatum, opvolgdatum en responsstatus. De hele rij is klikbaar; action-
// knoppen gebruiken stopPropagation zodat ze geen rij-click triggeren.
import { useState } from 'react';
import {
  Mail, MailCheck, FileEdit, ChevronDown, ChevronRight,
  Copy, FileDown, Send, Plus, Inbox, MessageSquare, Undo2, X,
} from 'lucide-react';
import {
  STAP_VOLGORDE, CAMPAGNE_STAP_LABEL,
  type CampagneStap, type GeadresseerdeGroep,
} from '@/lib/offMarket/brieven/groepering';
import {
  VERZENDSTATUS_LABEL, badgeClassVoorVerzendstatus,
  type Verzendstatus,
} from '@/lib/offMarket/brieven/verzendstatus';
import {
  RESPONS_LABEL, badgeClassVoorRespons, type Responsstatus,
} from '@/lib/offMarket/brieven/respons';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';

function formatDateNL(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

type Status = 'niet_gestart' | 'concept' | 'verstuurd';

function badgeClass(status: Status): string {
  switch (status) {
    case 'verstuurd':
      return 'bg-success/10 text-success border-success/25';
    case 'concept':
      return 'bg-secondary/15 text-foreground border-secondary/30';
    default:
      return 'bg-muted/40 text-muted-foreground border-border';
  }
}

function badgeLabel(status: Status): string {
  switch (status) {
    case 'verstuurd': return 'Verstuurd';
    case 'concept': return 'Concept';
    default: return 'Nog niet gestart';
  }
}

export interface EmailContactRegel {
  id: string;
  datum: string;
  titel: string;
}

export interface GeadresseerdeKaartProps {
  groep: GeadresseerdeGroep;
  emails?: EmailContactRegel[];
  onOpenBrief: (brief: OffMarketBrief) => void;
  onNieuweBrief: (groep: GeadresseerdeGroep, stap: CampagneStap) => void;
  onDownloadPdf: (brief: OffMarketBrief) => void;
  onKopieer: (brief: OffMarketBrief) => void;
  onMarkeerVerstuurd: (brief: OffMarketBrief) => void;
  onRegistreerRespons?: (brief: OffMarketBrief, initialStatus?: Responsstatus) => void;
}

export default function GeadresseerdeKaart({
  groep, emails = [],
  onOpenBrief, onNieuweBrief, onDownloadPdf, onKopieer, onMarkeerVerstuurd,
  onRegistreerRespons,
}: GeadresseerdeKaartProps) {
  return (
    <article
      data-testid="geadresseerde-kaart"
      data-geadresseerde-key={groep.key}
      className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-3.5 space-y-2.5"
    >
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground break-words">{groep.naam}</p>
          {groep.verzendadres && (
            <p className="text-[11px] text-muted-foreground whitespace-pre-line break-words mt-0.5">
              {groep.verzendadres}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
          <Mail className="h-3 w-3" /> Brief
        </span>
      </header>

      <ul className="divide-y divide-border/60 border border-border/60 rounded-md overflow-hidden">
        {STAP_VOLGORDE.map((stap) => {
          const s = groep.stappen[stap];
          const actief: OffMarketBrief | null = s.verstuurd ?? s.actiefConcept ?? null;
          const status: Status = s.verstuurd ? 'verstuurd' : s.actiefConcept ? 'concept' : 'niet_gestart';
          return (
            <StapRij
              key={stap}
              stap={stap}
              status={status}
              actief={actief}
              oudereConcepten={s.oudereConcepten}
              onOpen={onOpenBrief}
              onNieuw={() => onNieuweBrief(groep, stap)}
              onDownloadPdf={onDownloadPdf}
              onKopieer={onKopieer}
              onMarkeerVerstuurd={onMarkeerVerstuurd}
              onRegistreerRespons={onRegistreerRespons}
            />
          );
        })}
      </ul>

      {emails.length > 0 && (
        <div className="border-t border-border/60 pt-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">E-mailcontact</p>
          <ul className="space-y-1">
            {emails.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs text-foreground">
                <Inbox className="h-3 w-3 text-muted-foreground" />
                <span className="tabular-nums text-muted-foreground">{formatDateNL(e.datum)}</span>
                <span className="opacity-40">·</span>
                <span className="truncate">{e.titel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

// ---------- Stap-rij ----------

interface StapRijProps {
  stap: CampagneStap;
  status: Status;
  actief: OffMarketBrief | null;
  oudereConcepten: OffMarketBrief[];
  onOpen: (b: OffMarketBrief) => void;
  onNieuw: () => void;
  onDownloadPdf: (b: OffMarketBrief) => void;
  onKopieer: (b: OffMarketBrief) => void;
  onMarkeerVerstuurd: (b: OffMarketBrief) => void;
  onRegistreerRespons?: (b: OffMarketBrief, initialStatus?: Responsstatus) => void;
}

function StapRij({
  stap, status, actief, oudereConcepten,
  onOpen, onNieuw, onDownloadPdf, onKopieer, onMarkeerVerstuurd, onRegistreerRespons,
}: StapRijProps) {
  const [open, setOpen] = useState(false);

  const rijOpen = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!actief) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onOpen(actief);
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };

  const datum =
    status === 'verstuurd' && actief?.verzonden_op
      ? `Verzonden ${formatDateNL(actief.verzonden_op)}`
      : actief
        ? `Aangemaakt ${formatDateNL(actief.created_at)}`
        : '';

  const verzendstatus = (actief?.verzendstatus ?? null) as Verzendstatus | null;
  const responsstatus = (actief?.responsstatus ?? null) as Responsstatus | null;

  return (
    <li>
      <div
        role={actief ? 'button' : undefined}
        tabIndex={actief ? 0 : -1}
        data-testid={`stap-rij-${stap}`}
        data-status={status}
        onClick={actief ? rijOpen : undefined}
        onKeyDown={actief ? rijOpen : undefined}
        className={[
          'flex items-center justify-between gap-2 px-3 py-2.5',
          actief
            ? 'cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60'
            : 'cursor-default',
        ].join(' ')}
      >
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          {status === 'verstuurd'
            ? <MailCheck className="h-3.5 w-3.5 text-success shrink-0" />
            : status === 'concept'
              ? <FileEdit className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              : <Mail className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />}
          <span className="text-sm font-medium text-foreground">{CAMPAGNE_STAP_LABEL[stap]}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badgeClass(status)}`}>
            {badgeLabel(status)}
          </span>
          {verzendstatus && verzendstatus !== 'concept' && (
            <span
              data-testid={`verzendstatus-${stap}`}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badgeClassVoorVerzendstatus(verzendstatus)}`}
            >
              {VERZENDSTATUS_LABEL[verzendstatus]}
            </span>
          )}
          {responsstatus && (
            <span
              data-testid={`responsstatus-${stap}`}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badgeClassVoorRespons(responsstatus)}`}
            >
              {RESPONS_LABEL[responsstatus]}
            </span>
          )}
          {datum && <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">{datum}</span>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {actief && status === 'concept' && (
            <>
              <ActieKnop title="Markeer als verstuurd" onClick={stop(() => onMarkeerVerstuurd(actief))}>
                <Send className="h-3.5 w-3.5" />
              </ActieKnop>
              <ActieKnop title="Download PDF" onClick={stop(() => onDownloadPdf(actief))}>
                <FileDown className="h-3.5 w-3.5" />
              </ActieKnop>
              <ActieKnop title="Kopieer brief" onClick={stop(() => onKopieer(actief))}>
                <Copy className="h-3.5 w-3.5" />
              </ActieKnop>
            </>
          )}
          {actief && status === 'verstuurd' && (
            <>
              {onRegistreerRespons && (
                <>
                  <ActieKnop
                    title="Reactie registreren"
                    onClick={stop(() => onRegistreerRespons(actief, 'reactie_ontvangen'))}
                    data-testid={`respons-knop-${stap}`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </ActieKnop>
                  <ActieKnop
                    title="Retour post"
                    onClick={stop(() => onRegistreerRespons(actief, 'retour_post'))}
                    data-testid={`retour-knop-${stap}`}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </ActieKnop>
                  <ActieKnop
                    title="Geen reactie"
                    onClick={stop(() => onRegistreerRespons(actief, 'geen_reactie'))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </ActieKnop>
                </>
              )}
              <ActieKnop title="Download PDF" onClick={stop(() => onDownloadPdf(actief))}>
                <FileDown className="h-3.5 w-3.5" />
              </ActieKnop>
              <ActieKnop title="Kopieer brief" onClick={stop(() => onKopieer(actief))}>
                <Copy className="h-3.5 w-3.5" />
              </ActieKnop>
            </>
          )}
          {!actief && (
            <ActieKnop title={`${CAMPAGNE_STAP_LABEL[stap]} voorbereiden`} onClick={stop(onNieuw)}>
              <Plus className="h-3.5 w-3.5" />
            </ActieKnop>
          )}
          {status === 'verstuurd' && (
            <ActieKnop title="Nieuwe opvolgbrief voor deze geadresseerde" onClick={stop(onNieuw)}>
              <Plus className="h-3.5 w-3.5" />
            </ActieKnop>
          )}
        </div>
      </div>

      {actief && (actief.postdatum || actief.opvolgdatum) && (
        <div className="px-3 pb-2 -mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
          {actief.postdatum && <span>Postdatum {formatDateNL(actief.postdatum)}</span>}
          {actief.opvolgdatum && <span>Opvolging {formatDateNL(actief.opvolgdatum)}</span>}
          {actief.gekoppelde_taak_id && (
            <span className="text-[10px] italic opacity-70">taak gekoppeld</span>
          )}
        </div>
      )}

      {actief && datum && (
        <div className="sm:hidden px-3 pb-2 -mt-1 text-[11px] text-muted-foreground tabular-nums">
          {datum}
        </div>
      )}

      {oudereConcepten.length > 0 && (
        <div className="px-3 pb-2">
          <button
            type="button"
            data-testid={`oudere-concepten-toggle-${stap}`}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {oudereConcepten.length} {oudereConcepten.length === 1 ? 'ouder concept' : 'oudere concepten'}
          </button>
          {open && (
            <ul className="mt-1 ml-4 space-y-1">
              {oudereConcepten.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    data-testid={`ouder-concept-${c.id}`}
                    onClick={(e) => { e.stopPropagation(); onOpen(c); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Conceptversie van {formatDateNL(c.created_at)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function ActieKnop({
  title, onClick, children, ...rest
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  [k: string]: any;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-card/80 text-muted-foreground hover:text-foreground hover:border-accent/40"
      {...rest}
    >
      {children}
    </button>
  );
}
