import { memo, type ReactNode } from 'react';
import type { ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import type { ValidationItem } from '@/lib/vastgoedrekenen/validation';
import ValueField from './ValueField';

/**
 * Compact audit-zijpaneel: alleen samenvatting, bronverdeling en betrouwbaarheid.
 * De concrete herstelacties staan centraal in NogTeControleren en worden hier
 * bewust niet nogmaals als tekst herhaald.
 */
type SourceCounts = {
  componenten: number;
  strategie: number;
  wws: number;
  handmatig: number;
  scenario: number;
};

function categoryOf(item: ValidationItem) {
  return item.category ?? (item.level === 'info' ? 'later' : 'now');
}

function AuditSidePanel({
  outputs,
  items,
  sources,
  auditAction,
}: {
  outputs: ComputedOutputs;
  items: ValidationItem[];
  sources: SourceCounts;
  /** Optionele knop/element (bv. <AuditDialog />) voor de "open audit" actie. */
  auditAction?: ReactNode;
}) {
  const direct = items.filter((item) => categoryOf(item) === 'now');
  const later = items.filter((item) => categoryOf(item) === 'later');
  const notRelevant = items.filter((item) => categoryOf(item) === 'not_relevant');
  const directBlockers = direct.filter((item) => item.level === 'blocker').length;
  const directWarnings = direct.filter((item) => item.level === 'warning').length;

  const reliabilityTone =
    outputs.inputReliability === 'hoog'
      ? 'computed'
      : outputs.inputReliability === 'middel'
        ? 'derived'
        : 'missing';

  const totalSources = sources.componenten + sources.strategie + sources.wws + sources.handmatig + sources.scenario;

  return (
    <aside className="rounded-md border bg-card p-3 sm:p-4 space-y-3" aria-label="Audit-overzicht">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Audit & bronnen</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">Samenvatting; concrete herstelacties staan bovenaan het scenario.</p>
        </div>
        {auditAction}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ValueField
          label="Nu nodig"
          value={String(direct.length)}
          variant={directBlockers > 0 ? 'missing' : directWarnings > 0 ? 'derived' : 'computed'}
          hint={
            direct.length === 0
              ? 'Geen directe herstelactie'
              : `${directBlockers} blocker${directBlockers === 1 ? '' : 's'} · ${directWarnings} waarschuwing${directWarnings === 1 ? '' : 'en'}`
          }
        />
        <ValueField
          label="Later controleren"
          value={String(later.length)}
          variant={later.length > 0 ? 'derived' : 'computed'}
          hint={notRelevant.length > 0 ? `${notRelevant.length} onderdeel${notRelevant.length === 1 ? '' : 'delen'} niet relevant` : 'Geen latere dossiercontrole'}
        />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Gebruikte bronnen</p>
        {totalSources === 0 ? (
          <p className="text-xs text-muted-foreground">Nog geen bronnen geregistreerd.</p>
        ) : (
          <dl className="rounded-md border bg-muted/20 divide-y divide-border/60 text-xs">
            <SourceRow label="Componenten" count={sources.componenten} />
            <SourceRow label="Strategie" count={sources.strategie} />
            <SourceRow label="WWS" count={sources.wws} />
            <SourceRow label="Handmatig" count={sources.handmatig} />
            <SourceRow label="Scenario" count={sources.scenario} />
          </dl>
        )}
      </div>

      <ValueField
        label="Input-betrouwbaarheid"
        value={outputs.inputReliability === 'hoog' ? 'Hoog' : outputs.inputReliability === 'middel' ? 'Middel' : 'Laag'}
        variant={reliabilityTone}
        hint={
          outputs.inputReliability === 'hoog'
            ? 'Voldoende onderbouwd om beslissingen op te baseren.'
            : outputs.inputReliability === 'middel'
              ? 'Enkele aannames; controleer de leidende posten.'
              : 'Veel aannames — beperk het gewicht in de besluitvorming.'
        }
      />
    </aside>
  );
}

function SourceRow({ label, count }: { label: string; count: number }) {
  const has = count > 0;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-2 py-1">
      <dt className={has ? 'text-foreground' : 'text-muted-foreground'}>{label}</dt>
      <dd className={`font-mono-data tabular-nums text-[11px] ${has ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{count}</dd>
    </div>
  );
}

export default memo(AuditSidePanel);
