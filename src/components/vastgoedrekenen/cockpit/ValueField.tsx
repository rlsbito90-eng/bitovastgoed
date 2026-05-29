import type { ReactNode } from 'react';

/**
 * Klein presentatie-helper-component dat visueel onderscheid maakt tussen
 * invoervelden, berekende waarden, afgeleide waarden, info en ontbrekende data.
 * Geen rekenlogica — alleen styling + optionele bronvermelding.
 *
 * Bedoeld voor read-only weergave (bv. samenvattingen, audit-paneel,
 * waterfall-labels). Voor échte invoervelden blijven RawInputs leidend.
 */
export type ValueVariant = 'input' | 'computed' | 'derived' | 'info' | 'missing';

const VARIANT_CLS: Record<ValueVariant, string> = {
  // Invoer: subtiele dashed border (zoals elders al ad-hoc gebruikt)
  input:    'border border-dashed border-primary/40 bg-primary/5 text-foreground',
  // Berekend: solide, neutraal
  computed: 'border border-border bg-card text-foreground',
  // Afgeleid (van berekend): iets lichter
  derived:  'border border-border/60 bg-muted/30 text-foreground',
  // Info: rustig, secundair
  info:     'border border-transparent bg-muted/40 text-muted-foreground',
  // Ontbrekend: amber
  missing:  'border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
};

const VARIANT_LABEL: Record<ValueVariant, string> = {
  input: 'Invoer',
  computed: 'Berekend',
  derived: 'Afgeleid',
  info: 'Info',
  missing: 'Ontbreekt',
};

export default function ValueField({
  label,
  value,
  variant = 'computed',
  source,
  hint,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  variant?: ValueVariant;
  source?: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-md p-3 min-w-0 ${VARIANT_CLS[variant]} ${className}`}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate-none break-words">
          {label}
        </p>
        <span
          className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border bg-background/60 text-muted-foreground shrink-0"
          title={source ?? VARIANT_LABEL[variant]}
        >
          {VARIANT_LABEL[variant]}
        </span>
      </div>
      <p className="text-base font-semibold font-mono-data mt-0.5 break-words leading-tight">
        {value}
      </p>
      {(source || hint) && (
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug break-words">
          {source && <span className="text-foreground/80">Bron: {source}</span>}
          {source && hint ? ' · ' : ''}
          {hint}
        </p>
      )}
    </div>
  );
}
