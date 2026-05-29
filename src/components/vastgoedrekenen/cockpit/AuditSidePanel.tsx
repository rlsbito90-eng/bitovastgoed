import type { ReactNode } from 'react';
import type { ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import type { ValidationItem } from '@/lib/vastgoedrekenen/validation';
import ValueField from './ValueField';

/**
 * Compact audit-zijpaneel: aandachtspunten, gebruikte bronnen,
 * betrouwbaarheid en een snelle ingang naar de bestaande AuditDialog.
 *
 * Pure presentatie — leest alleen bestaande outputs en validatie-items.
 */
type SourceCounts = {
  componenten: number;
  strategie: number;
  wws: number;
  handmatig: number;
  scenario: number;
};

export default function AuditSidePanel({
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
  const blockers = items.filter((i) => i.level === 'blocker');
  const warnings = items.filter((i) => i.level === 'warning');

  const reliabilityTone =
    outputs.inputReliability === 'hoog'
      ? 'computed'
      : outputs.inputReliability === 'middel'
        ? 'derived'
        : 'missing';

  const totalSources = sources.componenten + sources.strategie + sources.wws + sources.handmatig + sources.scenario;

  return (
    <aside
      className="rounded-md border bg-card p-3 sm:p-4 space-y-3"
      aria-label="Audit-overzicht"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">Audit & bronnen</h4>
        {auditAction}
      </div>

      {/* Aandachtspunten */}
      <div className="grid grid-cols-2 gap-2">
        <ValueField
          label="Blockers"
          value={String(blockers.length)}
          variant={blockers.length > 0 ? 'missing' : 'computed'}
          hint={blockers.length === 0 ? 'Geen blokkers' : 'Vereisen actie'}
        />
        <ValueField
          label="Waarschuwingen"
          value={String(warnings.length)}
          variant={warnings.length > 0 ? 'derived' : 'computed'}
          hint={warnings.length === 0 ? 'Geen waarschuwingen' : 'Controleer'}
        />
      </div>

      {/* Top blockers/warnings */}
      {(blockers.length > 0 || warnings.length > 0) && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs space-y-1.5">
          <p className="font-medium text-amber-900 dark:text-amber-200">Top aandachtspunten</p>
          <ul className="space-y-1 text-amber-900/90 dark:text-amber-200/90">
            {[...blockers, ...warnings].slice(0, 4).map((it, i) => (
              <li key={i} className="leading-snug break-words">
                <span className="font-medium">{it.level === 'blocker' ? '■' : '▲'}</span>{' '}
                {it.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bronverdeling */}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          Gebruikte bronnen
        </p>
        {totalSources === 0 ? (
          <p className="text-xs text-muted-foreground">Nog geen bronnen geregistreerd.</p>
        ) : (
          <ul className="text-xs space-y-1">
            <SourceRow label="Componenten" count={sources.componenten} />
            <SourceRow label="Strategie" count={sources.strategie} />
            <SourceRow label="WWS-units" count={sources.wws} />
            <SourceRow label="Handmatig" count={sources.handmatig} />
            <SourceRow label="Scenario-level" count={sources.scenario} />
          </ul>
        )}
      </div>

      {/* Betrouwbaarheid */}
      <ValueField
        label="Input-betrouwbaarheid"
        value={
          outputs.inputReliability === 'hoog'
            ? 'Hoog'
            : outputs.inputReliability === 'middel'
              ? 'Middel'
              : 'Laag'
        }
        variant={reliabilityTone}
        hint={
          outputs.inputReliability === 'hoog'
            ? 'Voldoende onderbouwd om beslissingen op te baseren.'
            : outputs.inputReliability === 'middel'
              ? 'Enkele aannames; controleer kritieke posten.'
              : 'Veel aannames — beperk gewicht in de besluitvorming.'
        }
      />
    </aside>
  );
}

function SourceRow({ label, count }: { label: string; count: number }) {
  const has = count > 0;
  return (
    <li className="flex items-center justify-between gap-2 min-w-0">
      <span className={`truncate-none break-words ${has ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${
        has ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'
      }`}>
        {count}
      </span>
    </li>
  );
}
