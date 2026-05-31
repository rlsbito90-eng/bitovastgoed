import * as React from 'react';
import { Input } from './input';
import { parseDutchNumber, toEditableNL } from '@/lib/format/nl';

/**
 * App-brede numerieke input.
 * - Mobielvriendelijk keypad (inputMode="decimal" of "numeric").
 * - Accepteert zowel komma als punt als decimaalteken.
 * - Toont Nederlandse formattering (1.625.000 / 6,5) bij blur.
 * - Lege waarde blijft leeg → `undefined` (geen 0, geen NaN).
 * - Geen schemawijziging: emit blijft een gewone JS `number`.
 */
export type NumberFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number | null | undefined;
  onChange: (value: number | undefined) => void;
  /** Forceer geheel getal (geen decimalen, numeriek keypad). */
  integer?: boolean;
  /** Maximaal aantal decimalen voor weergave. Default: 0 voor integer, anders 4. */
  decimals?: number;
};

function formatDisplay(value: number, integer: boolean | undefined, decimals: number | undefined): string {
  if (!Number.isFinite(value)) return '';
  const max = integer ? 0 : decimals ?? 4;
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  }).format(integer ? Math.trunc(value) : value);
}

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField({ value, onChange, integer, decimals, className, ...rest }, ref) {
    const [focused, setFocused] = React.useState(false);
    const [raw, setRaw] = React.useState<string>(() =>
      value == null ? '' : formatDisplay(Number(value), integer, decimals),
    );
    const lastEmittedRef = React.useRef<number | undefined>(
      value == null || !Number.isFinite(Number(value)) ? undefined : Number(value),
    );

    // Externe wijzigingen overnemen wanneer veld niet in focus is.
    React.useEffect(() => {
      if (focused) return;
      const next = value == null || !Number.isFinite(Number(value)) ? undefined : Number(value);
      if (next === lastEmittedRef.current) return;
      lastEmittedRef.current = next;
      setRaw(next == null ? '' : formatDisplay(next, integer, decimals));
    }, [value, focused, integer, decimals]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      // Toon editbare vorm (geen duizendscheidingen, komma als decimaal).
      if (value != null && Number.isFinite(Number(value))) {
        setRaw(integer ? String(Math.trunc(Number(value))) : toEditableNL(Number(value)));
      }
      rest.onFocus?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const s = e.target.value;
      setRaw(s);
      if (s.trim() === '') {
        if (lastEmittedRef.current !== undefined) {
          lastEmittedRef.current = undefined;
          onChange(undefined);
        }
        return;
      }
      const parsed = parseDutchNumber(s);
      // Tijdens typen ("2,", "1.") parseDutchNumber kan null geven → wachten op blur.
      if (parsed == null || !Number.isFinite(parsed)) return;
      const next = integer ? Math.trunc(parsed) : parsed;
      if (next !== lastEmittedRef.current) {
        lastEmittedRef.current = next;
        onChange(next);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      const trimmed = raw.trim();
      if (trimmed === '') {
        if (lastEmittedRef.current !== undefined) {
          lastEmittedRef.current = undefined;
          onChange(undefined);
        }
        setRaw('');
      } else {
        const parsed = parseDutchNumber(trimmed);
        if (parsed == null || !Number.isFinite(parsed)) {
          // Ongeldige invoer: terug naar laatste geldige waarde.
          setRaw(
            lastEmittedRef.current == null
              ? ''
              : formatDisplay(lastEmittedRef.current, integer, decimals),
          );
        } else {
          const next = integer ? Math.trunc(parsed) : parsed;
          if (next !== lastEmittedRef.current) {
            lastEmittedRef.current = next;
            onChange(next);
          }
          setRaw(formatDisplay(next, integer, decimals));
        }
      }
      rest.onBlur?.(e);
    };

    return (
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        pattern={integer ? '[0-9]*' : undefined}
        value={raw}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        className={className}
      />
    );
  },
);
