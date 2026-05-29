import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  parseDutchNumber,
  toEditableNL,
  formatNumberForKind,
  type FormatKind,
} from '@/lib/format/nl';
import { useIsTouch } from '@/hooks/useIsTouch';

type RawInputProps = {
  initialValue: string;
  onRawChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  suffix?: string;
};

// Backwards-compatible helpers (oude callsites blijven werken).
export function numberToRaw(value: number | null | undefined): string {
  return toEditableNL(value);
}

export function parseRawNumber(raw: string): number | null {
  return parseDutchNumber(raw);
}

function useRawInput(initialValue: string, onRawChange?: (value: string) => void, onCommit?: (value: string) => void) {
  const [raw, setRaw] = useState(initialValue);
  const focusedRef = useRef(false);
  const externalRef = useRef(initialValue);

  useEffect(() => {
    if (initialValue === externalRef.current) return;
    externalRef.current = initialValue;
    if (!focusedRef.current) setRaw(initialValue);
  }, [initialValue]);

  const change = (value: string) => {
    setRaw(value);
    onRawChange?.(value);
  };

  const blur = () => {
    focusedRef.current = false;
    if (raw !== externalRef.current) {
      externalRef.current = raw;
      onCommit?.(raw);
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.currentTarget instanceof HTMLInputElement) {
      event.currentTarget.blur();
    }
  };

  return {
    raw,
    change,
    focus: () => { focusedRef.current = true; },
    blur,
    keyDown,
    focusedRef,
  };
}

export const RawTextInput = memo(function RawTextInput({ initialValue, onRawChange, onCommit, placeholder, className }: RawInputProps) {
  const input = useRawInput(initialValue, onRawChange, onCommit);

  return (
    <Input
      type="text"
      value={input.raw}
      placeholder={placeholder}
      onFocus={input.focus}
      onChange={(e) => input.change(e.target.value)}
      onBlur={input.blur}
      onKeyDown={input.keyDown}
      className={className}
    />
  );
});

export const RawTextarea = memo(function RawTextarea({ initialValue, onRawChange, onCommit, placeholder, className, rows = 3 }: RawInputProps & { rows?: number }) {
  const input = useRawInput(initialValue, onRawChange, onCommit);

  return (
    <Textarea
      value={input.raw}
      placeholder={placeholder}
      rows={rows}
      onFocus={input.focus}
      onChange={(e) => input.change(e.target.value)}
      onBlur={input.blur}
      onKeyDown={input.keyDown}
      className={className}
    />
  );
});

type NumberFormatProps = RawInputProps & {
  format?: FormatKind;
  decimals?: number;
};

function inferKindFromSuffix(suffix: string | undefined, explicit?: FormatKind): FormatKind | undefined {
  if (explicit) return explicit;
  if (!suffix) return undefined;
  const s = suffix.trim();
  if (s === '€') return 'currency';
  if (s === '%') return 'percent';
  if (s === 'm²' || s === 'm2') return 'area';
  return undefined;
}

export const RawNumberInput = memo(function RawNumberInput({ initialValue, onRawChange, onCommit, placeholder, className, suffix, format, decimals }: NumberFormatProps) {
  const kind = inferKindFromSuffix(suffix, format);

  // Bepaal weergavewaarde: tijdens focus de editbare string, daarbuiten geformatteerd.
  const computeDisplay = (rawStr: string, focused: boolean): string => {
    if (focused) return rawStr;
    if (!kind) return rawStr;
    const n = parseDutchNumber(rawStr);
    if (n == null) return rawStr;
    return formatNumberForKind(n, kind, decimals);
  };

  const [raw, setRaw] = useState(() => computeDisplay(initialValue, false));
  const [focused, setFocused] = useState(false);
  const externalRef = useRef(initialValue);

  useEffect(() => {
    if (initialValue === externalRef.current) return;
    externalRef.current = initialValue;
    if (!focused) setRaw(computeDisplay(initialValue, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    // Toon editbare vorm bij focus zodat gebruiker eenvoudig kan typen.
    let nextRaw = raw;
    if (kind) {
      const n = parseDutchNumber(raw);
      if (n != null) {
        nextRaw = toEditableNL(n);
        setRaw(nextRaw);
      }
    }
    // Selecteer de volledige inhoud zodat typen direct overschrijft
    // (vooral handig bij default-0 of bestaande waarden).
    const el = event.currentTarget;
    requestAnimationFrame(() => {
      try { el.select(); } catch { /* noop */ }
    });
  };

  const handleChange = (value: string) => {
    setRaw(value);
    onRawChange?.(value);
  };

  const handleBlur = () => {
    setFocused(false);
    const n = parseDutchNumber(raw);
    const editableForCommit = n == null ? raw.trim() : toEditableNL(n);
    if (editableForCommit !== externalRef.current) {
      externalRef.current = editableForCommit;
      onCommit?.(editableForCommit);
    }
    // Zet displayed weer naar geformatteerd.
    setRaw(n != null && kind ? formatNumberForKind(n, kind, decimals) : (n != null ? toEditableNL(n) : raw.trim()));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  return (
    <div className="relative w-full min-w-0">
      <Input
        type="text"
        inputMode="decimal"
        value={raw}
        placeholder={placeholder}
        onFocus={handleFocus}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${className ?? ''} ${suffix ? 'pr-9' : ''}`}
      />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
    </div>
  );
});
