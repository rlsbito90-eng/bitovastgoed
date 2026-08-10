// Kaart per geadresseerde binnen Brieven & opvolging.
// De primaire acties zijn expliciet gelabeld; minder frequente en correctie-
// acties staan onder "Meer" zodat de mobiele bediening begrijpelijk blijft.
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Mail, MailCheck, FileEdit, ChevronDown, ChevronRight,
  Copy, FileDown, Send, Plus, Inbox, MessageSquare, MoreHorizontal,
  Trash2, Pencil,
} from 'lucide-react';
import {
  STAP_VOLGORDE, CAMPAGNE_STAP_LABEL,
  type CampagneStap, type GeadresseerdeGroep,
} from '@/lib/offMarket/brieven/groepering';
import {
  EMAIL_STAP_VOLGORDE, EMAIL_STAP_LABEL, type EmailStap,
} from '@/lib/offMarket/email/emailProfielen';
import {
  VERZENDSTATUS_LABEL, badgeClassVoorVerzendstatus,
  type Verzendstatus,
} from '@/lib/offMarket/brieven/verzendstatus';
import {
  RESPONS_LABEL, badgeClassVoorRespons, type Responsstatus,
} from '@/lib/offMarket/brieven/respons';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import {
  useVerwijderBriefRespons,
  useVerwijderBriefUitWorkflow,
} from '@/hooks/useBriefCorrecties';

function formatDateNL(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

type Status = 'niet_gestart' | 'concept' | 'verstuurd';

function badgeClass(status: Status): string {
  switch (status) {
    case 'verstuurd': return 'bg-success/10 text-success border-success/25';
    case 'concept': return 'bg-secondary/15 text-foreground border-secondary/30';
    default: return 'bg-muted/40 text-muted-foreground border-border';
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
  onNieuweBrief: (groep: GeadresseerdeGroep, stap: CampagneStap | EmailStap) => void;
  onDownloadPdf: (brief: OffMarketBrief) => void;
  onKopieer: (brief: OffMarketBrief) => void;
  onMarkeerVerstuurd: (brief: OffMarketBrief) => void;
  onRegistreerRespons?: (brief: OffMarketBrief, initialStatus?: Responsstatus) => void;
}

export default function GeadresseerdeKaart({
  groep,
  emails = [],
  onOpenBrief,
  onNieuweBrief,
  onDownloadPdf,
  onKopieer,
  onMarkeerVerstuurd,
  onRegistreerRespons,
}: GeadresseerdeKaartProps) {
  const verwijderBrief = useVerwijderBriefUitWorkflow();
  const verwijderRespons = useVerwijderBriefRespons();

  const heeftEmailBrieven = EMAIL_STAP_VOLGORDE.some((s) => {
    const stap = groep.emailStappen?.[s];
    return !!(stap?.verstuurd || stap?.actiefConcept || stap?.oudereConcepten.length);
  });

  const handleVerwijderBrief = async (brief: OffMarketBrief) => {
    const isVerstuurd = brief.status === 'verstuurd';
    const tekst = isVerstuurd
      ? 'Deze verzonden brief wordt uit de actieve workflow verwijderd. De auditgeschiedenis blijft bewaard. Doorgaan?'
      : 'Dit concept uit de actieve briefworkflow verwijderen?';
    if (!window.confirm(tekst)) return;
    try {
      await verwijderBrief.mutateAsync(brief);
      toast.success(isVerstuurd ? 'Brief uit actieve workflow verwijderd' : 'Concept verwijderd');
      if (brief.gekoppelde_taak_id) {
        toast.info('Let op: de gekoppelde opvolgtaak is niet automatisch verwijderd.');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Brief verwijderen mislukt');
    }
  };

  const handleVerwijderRespons = async (brief: OffMarketBrief) => {
    if (!window.confirm('De geregistreerde reactie van deze brief verwijderen? De correctie blijft zichtbaar in de auditgeschiedenis.')) return;
    try {
      await verwijderRespons.mutateAsync(brief);
      toast.success('Reactie verwijderd');
    } catch (e: any) {
      toast.error(e?.message ?? 'Reactie verwijderen mislukt');
    }
  };

  return (
    <article
      data-testid="geadresseerde-kaart"
      data-geadresseerde-key={groep.key}
      className="rounded-lg border border-border bg-card/60 backdrop-blur-sm p-3.5 space-y-2.5"
    >
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground break-words">{groep.naam}</p>
          {groep.verzendadres && (
            <p className="text-[11px] text-muted-foreground whitespace-pre-line break-words mt-0.5">
              {groep.verzendadres}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            data-testid={`kanaalbadge-post-${groep.key}`}
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground"
          >
            <Mail className="h-3 w-3" /> Brief
          </span>
          {heeftEmailBrieven && (
            <span
              data-testid={`kanaalbadge-email-${groep.key}`}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-accent/30 bg-accent/15 text-accent-foreground"
            >
              <Inbox className="h-3 w-3" /> E-mail
            </span>
          )}
        </div>
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
              label={CAMPAGNE_STAP_LABEL[stap]}
              isEmail={false}
              status={status}
              actief={actief}
              oudereConcepten={s.oudereConcepten}
              onOpen={onOpenBrief}
              onNieuw={() => onNieuweBrief(groep, stap)}
              onDownloadPdf={onDownloadPdf}
              onKopieer={onKopieer}
              onMarkeerVerstuurd={onMarkeerVerstuurd}
              onRegistreerRespons={onRegistreerRespons}
              onVerwijderBrief={handleVerwijderBrief}
              onVerwijderRespons={handleVerwijderRespons}
            />
          );
        })}
      </ul>

      {heeftEmailBrieven && (
        <ul
          data-testid="email-stappen-lijst"
          className="divide-y divide-border/60 border border-border/60 rounded-md overflow-hidden"
        >
          {EMAIL_STAP_VOLGORDE.map((stap) => {
            const s = groep.emailStappen[stap];
            const actief: OffMarketBrief | null = s.verstuurd ?? s.actiefConcept ?? null;
            const status: Status = s.verstuurd ? 'verstuurd' : s.actiefConcept ? 'concept' : 'niet_gestart';
            return (
              <StapRij
                key={stap}
                stap={stap}
                label={EMAIL_STAP_LABEL[stap]}
                isEmail={true}
                status={status}
                actief={actief}
                oudereConcepten={s.oudereConcepten}
                onOpen={onOpenBrief}
                onNieuw={() => onNieuweBrief(groep, stap as EmailStap)}
                onDownloadPdf={onDownloadPdf}
                onKopieer={onKopieer}
                onMarkeerVerstuurd={onMarkeerVerstuurd}
                onRegistreerRespons={onRegistreerRespons}
                onVerwijderBrief={handleVerwijderBrief}
                onVerwijderRespons={handleVerwijderRespons}
              />
            );
          })}
        </ul>
      )}

      {emails.length > 0 && (
        <div className="border-t border-border/60 pt-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Overige e-mailcontactmomenten</p>
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

interface StapRijProps {
  stap: string;
  label: string;
  isEmail?: boolean;
  status: Status;
  actief: OffMarketBrief | null;
  oudereConcepten: OffMarketBrief[];
  onOpen: (b: OffMarketBrief) => void;
  onNieuw: () => void;
  onDownloadPdf: (b: OffMarketBrief) => void;
  onKopieer: (b: OffMarketBrief) => void;
  onMarkeerVerstuurd: (b: OffMarketBrief) => void;
  onRegistreerRespons?: (b: OffMarketBrief, initialStatus?: Responsstatus) => void;
  onVerwijderBrief: (b: OffMarketBrief) => void;
  onVerwijderRespons: (b: OffMarketBrief) => void;
}

function StapRij({
  stap,
  label,
  isEmail = false,
  status,
  actief,
  oudereConcepten,
  onOpen,
  onNieuw,
  onDownloadPdf,
  onKopieer,
  onMarkeerVerstuurd,
  onRegistreerRespons,
  onVerwijderBrief,
  onVerwijderRespons,
}: StapRijProps) {
  const [oudeConceptenOpen, setOudeConceptenOpen] = useState(false);
  const [meerOpen, setMeerOpen] = useState(false);

  const datum = status === 'verstuurd' && actief?.verzonden_op
    ? `Verzonden ${formatDateNL(actief.verzonden_op)}`
    : actief
      ? `Aangemaakt ${formatDateNL(actief.created_at)}`
      : '';

  const verzendstatus = (actief?.verzendstatus ?? null) as Verzendstatus | null;
  const responsstatus = (actief?.responsstatus ?? null) as Responsstatus | null;

  const rijOpen = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!actief) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onOpen(actief);
  };

  return (
    <li
      data-testid={`stap-rij-${stap}`}
      data-status={status}
      role={actief ? 'button' : undefined}
      tabIndex={actief ? 0 : -1}
      onClick={actief ? rijOpen : undefined}
      onKeyDown={actief ? rijOpen : undefined}
      className={`px-3 py-3 space-y-2.5 ${actief ? 'cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {status === 'verstuurd'
              ? <MailCheck className="h-4 w-4 text-success shrink-0" />
              : status === 'concept'
                ? <FileEdit className="h-4 w-4 text-muted-foreground shrink-0" />
                : <Mail className="h-4 w-4 text-muted-foreground/70 shrink-0" />}
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {isEmail && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-accent/30 bg-accent/15 text-accent-foreground">
                <Inbox className="h-3 w-3" /> E-mail
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
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
          </div>
        </div>
      </div>

      {actief && (datum || actief.postdatum || actief.opvolgdatum) && (
        <div className="text-[11px] leading-5 text-muted-foreground tabular-nums">
          {datum && <div>{datum}</div>}
          {actief.postdatum && <div>Postdatum {formatDateNL(actief.postdatum)}</div>}
          {actief.opvolgdatum && (
            <div>
              Opvolging {formatDateNL(actief.opvolgdatum)}
              {actief.gekoppelde_taak_id && <span className="ml-2 italic opacity-70">taak gekoppeld</span>}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {!actief && (
          <DuidelijkeActie onClick={onNieuw} icon={<Plus className="h-3.5 w-3.5" />}>
            Start {label.toLowerCase()}
          </DuidelijkeActie>
        )}

        {actief && status === 'concept' && (
          <>
            <DuidelijkeActie onClick={() => onOpen(actief)} icon={<Pencil className="h-3.5 w-3.5" />}>
              Openen
            </DuidelijkeActie>
            <DuidelijkeActie onClick={() => onMarkeerVerstuurd(actief)} icon={<Send className="h-3.5 w-3.5" />} accent>
              Versturen
            </DuidelijkeActie>
            {!isEmail && (
              <DuidelijkeActie
                onClick={() => onDownloadPdf(actief)}
                icon={<FileDown className="h-3.5 w-3.5" />}
                aria-label="Download PDF"
                title="Download PDF"
              >
                PDF
              </DuidelijkeActie>
            )}
            <DuidelijkeActie onClick={() => setMeerOpen((v) => !v)} icon={<MoreHorizontal className="h-3.5 w-3.5" />}>
              Meer
            </DuidelijkeActie>
          </>
        )}

        {actief && status === 'verstuurd' && (
          <>
            {onRegistreerRespons && (
              <DuidelijkeActie
                onClick={() => onRegistreerRespons(actief, responsstatus ?? 'reactie_ontvangen')}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                accent={!responsstatus}
                data-testid={`respons-knop-${stap}`}
              >
                {responsstatus ? 'Reactie aanpassen' : 'Reactie registreren'}
              </DuidelijkeActie>
            )}
            {!isEmail && (
              <DuidelijkeActie
                onClick={() => onDownloadPdf(actief)}
                icon={<FileDown className="h-3.5 w-3.5" />}
                aria-label="Download PDF"
                title="Download PDF"
              >
                PDF
              </DuidelijkeActie>
            )}
            <DuidelijkeActie onClick={() => setMeerOpen((v) => !v)} icon={<MoreHorizontal className="h-3.5 w-3.5" />}>
              Meer
            </DuidelijkeActie>
          </>
        )}
      </div>

      {actief && meerOpen && (
        <div className="rounded-md border border-border/70 bg-muted/20 p-2.5 flex flex-wrap gap-2" data-testid={`brief-meer-acties-${stap}`}>
          <DuidelijkeActie onClick={() => onOpen(actief)} icon={<Pencil className="h-3.5 w-3.5" />} compact>
            Brief openen
          </DuidelijkeActie>
          <DuidelijkeActie onClick={() => onKopieer(actief)} icon={<Copy className="h-3.5 w-3.5" />} compact>
            Kopiëren
          </DuidelijkeActie>
          {status === 'verstuurd' && (
            <DuidelijkeActie onClick={onNieuw} icon={<Plus className="h-3.5 w-3.5" />} compact>
              Nieuwe opvolgbrief
            </DuidelijkeActie>
          )}
          {responsstatus && (
            <DuidelijkeActie
              onClick={() => onVerwijderRespons(actief)}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              compact
              destructive
              data-testid={`respons-verwijderen-${stap}`}
            >
              Reactie verwijderen
            </DuidelijkeActie>
          )}
          <DuidelijkeActie
            onClick={() => onVerwijderBrief(actief)}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            compact
            destructive
            data-testid={`brief-verwijderen-${stap}`}
          >
            {status === 'verstuurd' ? 'Brief verwijderen' : 'Concept verwijderen'}
          </DuidelijkeActie>
        </div>
      )}

      {oudereConcepten.length > 0 && (
        <div>
          <button
            type="button"
            data-testid={`oudere-concepten-toggle-${stap}`}
            onClick={(e) => { e.stopPropagation(); setOudeConceptenOpen((v) => !v); }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {oudeConceptenOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {oudereConcepten.length} {oudereConcepten.length === 1 ? 'ouder concept' : 'oudere concepten'}
          </button>
          {oudeConceptenOpen && (
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

function DuidelijkeActie({
  onClick,
  icon,
  children,
  accent = false,
  compact = false,
  destructive = false,
  ...rest
}: {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
  compact?: boolean;
  destructive?: boolean;
  [k: string]: any;
}) {
  const kleur = destructive
    ? 'border-destructive/35 text-destructive hover:bg-destructive/10'
    : accent
      ? 'border-accent/45 bg-accent/15 text-foreground hover:bg-accent/20'
      : 'border-border bg-card/70 text-foreground hover:bg-muted/50';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors ${kleur} ${compact ? 'min-h-8 px-2.5 text-[11px]' : 'min-h-9 px-3 text-xs'}`}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
