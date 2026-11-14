import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';

type InlineValue = string | number;

interface Props {
  label: string;
  value: InlineValue | null | undefined;
  kind?: 'text' | 'number';
  required?: boolean;
  format?: (value: InlineValue) => string;
  onSave: (value: InlineValue) => Promise<unknown>;
}

/** Bewaar met Enter, Tab of focusverlies; Escape annuleert. */
export default function InlineObjectField({
  label, value, kind = 'text', required = false, format, onSave,
}: Props) {
  const current = value == null ? '' : String(value);
  const [draft, setDraft] = useState(current);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const cancelRef = useRef(false);
  const originalRef = useRef(current);

  useEffect(() => {
    if (!editing && !saving) setDraft(current);
  }, [current, editing, saving]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const begin = () => {
    if (saving) return;
    originalRef.current = current;
    cancelRef.current = false;
    setDraft(current);
    setSaved(false);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    if (saving) return;
    cancelRef.current = true;
    setDraft(originalRef.current);
    setError(null);
    setEditing(false);
  };

  const commit = async () => {
    if (busyRef.current || cancelRef.current) return;
    const trimmed = draft.trim();
    if (required && !trimmed) {
      setError('Dit veld mag niet leeg zijn.');
      inputRef.current?.focus();
      return;
    }
    let next: InlineValue;
    if (kind === 'number') {
      if (!trimmed) {
        setError('Vul een bedrag in. Leegmaken kan via uitgebreid bewerken.');
        inputRef.current?.focus();
        return;
      }
      const parsed = Number(trimmed.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Vul een geldig, niet-negatief bedrag in.');
        inputRef.current?.focus();
        return;
      }
      next = parsed;
    } else {
      next = trimmed;
    }
    if (String(next) === originalRef.current) {
      setEditing(false);
      setError(null);
      return;
    }
    if (current !== originalRef.current) {
      setError('Dit veld is inmiddels elders gewijzigd. Open het opnieuw.');
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Opslaan mislukt. Je invoer is behouden.');
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const formatted = value == null ? '—' : (format ? format(value) : String(value));
  return (
    <span className="inline-flex max-w-full min-w-0 flex-col items-start gap-1 align-middle">
      {editing ? (
        <input ref={inputRef} aria-label={label}
          type={kind === 'number' ? 'number' : 'text'}
          min={kind === 'number' ? 0 : undefined} step={kind === 'number' ? 'any' : undefined}
          value={draft} disabled={saving}
          onChange={(event) => { setDraft(event.target.value); setError(null); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); void commit(); }
            else if (event.key === 'Escape') { event.preventDefault(); cancel(); }
          }}
          onBlur={() => { if (!cancelRef.current) void commit(); }}
          className="h-9 w-full min-w-[10rem] max-w-full rounded-md border border-accent bg-background px-2 text-base font-medium text-foreground outline-none ring-2 ring-accent/20"
        />
      ) : (
        <button type="button" aria-label={label + ' direct wijzigen'}
          title={label + ' wijzigen'} onClick={begin}
          className="group inline-flex max-w-full items-center gap-1.5 break-words text-left text-inherit hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          <span className="min-w-0 break-words">{formatted}</span>
          {saving
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            : <Pencil className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100" aria-hidden="true" />}
        </button>
      )}
      {error && <span role="alert" className="text-xs font-normal leading-snug text-destructive">{error}</span>}
      {saved && !editing && !error &&
        <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground" role="status">
          <Check className="h-3 w-3" aria-hidden="true" /> Opgeslagen
        </span>}
    </span>
  );
}
