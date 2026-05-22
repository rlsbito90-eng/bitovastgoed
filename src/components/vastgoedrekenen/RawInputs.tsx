import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type RawInputProps = {
  initialValue: string;
  onRawChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  suffix?: string;
};

export function numberToRaw(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

export function parseRawNumber(raw: string): number | null {
  const stripped = raw.trim().replace(/[€%\s]/g, '');
  if (!stripped || stripped === '-' || stripped === ',' || stripped === '.') return null;

  const hasComma = stripped.includes(',');
  const hasDot = stripped.includes('.');
  let normalized = stripped;

  if (hasComma && hasDot) {
    normalized = stripped.lastIndexOf(',') > stripped.lastIndexOf('.')
      ? stripped.replace(/\./g, '').replace(',', '.')
      : stripped.replace(/,/g, '');
  } else if (hasComma) {
    normalized = stripped.replace(',', '.');
  } else if (hasDot) {
    const parts = stripped.split('.');
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    normalized = looksLikeThousands ? parts.join('') : stripped;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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

export const RawNumberInput = memo(function RawNumberInput({ initialValue, onRawChange, onCommit, placeholder, className, suffix }: RawInputProps) {
  const input = useRawInput(initialValue, onRawChange, onCommit);

  return (
    <div className="relative w-full min-w-0">
      <Input
        type="text"
        inputMode="decimal"
        value={input.raw}
        placeholder={placeholder}
        onFocus={input.focus}
        onChange={(e) => input.change(e.target.value)}
        onBlur={input.blur}
        onKeyDown={input.keyDown}
        className={`${className ?? ''} ${suffix ? 'pr-9' : ''}`}
      />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
    </div>
  );
});