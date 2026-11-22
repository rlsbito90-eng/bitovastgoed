import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { ObjectVastgoed } from '@/data/mock-data';

type Props = {
  object: ObjectVastgoed;
  onSave: (patch: Pick<ObjectVastgoed, 'titel'>) => Promise<void>;
};

/**
 * De objectnaam is een veelgebruikt dossiergegeven: één tik op de waarde
 * opent direct het veld. Enter of blur slaat uitsluitend de titel op;
 * Escape annuleert, zonder het uitgebreide objectformulier te openen.
 */
export default function ObjectTitelInline({ object, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [concept, setConcept] = useState(object.titel);
  const [error, setError] = useState('');
  const currentObject = useRef(object);
  currentObject.current = object;
  const latest = useRef(object.titel);
  const original = useRef(object.titel);
  const editingRef = useRef(false);
  const inFlight = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    editingRef.current = false;
    cancelled.current = false;
    setEditing(false);
    setError('');
    setConcept(object.titel);
    latest.current = object.titel;
    original.current = object.titel;
  // Een ander dossier mag nooit de concepttitel uit het vorige dossier overnemen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.id]);

  useEffect(() => {
    if (editingRef.current || inFlight.current) return;
    latest.current = object.titel;
    original.current = object.titel;
    setConcept(object.titel);
  }, [object.titel]);

  function start() {
    if (inFlight.current) return;
    cancelled.current = false;
    editingRef.current = true;
    original.current = object.titel;
    latest.current = object.titel;
    setConcept(object.titel);
    setError('');
    setEditing(true);
  }

  function cancel() {
    cancelled.current = true;
    editingRef.current = false;
    setEditing(false);
    setError('');
    latest.current = currentObject.current.titel;
    setConcept(currentObject.current.titel);
  }

  async function save() {
    if (!editingRef.current || inFlight.current || cancelled.current) return;

    const next = latest.current.trim();
    const previous = original.current;
    if (!next) {
      setError('Een objectnaam mag niet leeg zijn.');
      return;
    }
    if (next === previous) {
      editingRef.current = false;
      setEditing(false);
      setError('');
      return;
    }
    if (currentObject.current.titel !== previous) {
      setError('De objectnaam is inmiddels gewijzigd. Annuleer en open het veld opnieuw.');
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave({ titel: next });
      editingRef.current = false;
      setEditing(false);
      toast.success('Objectnaam opgeslagen', {
        action: {
          label: 'Ongedaan maken',
          onClick: () => { void onSave({ titel: previous })
            .catch(() => toast.error('Herstellen mislukt')); },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Objectnaam opslaan mislukt.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="min-w-0" data-testid="object-titel-inline">
    <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-semibold text-foreground tracking-tight leading-[1.1] break-words drop-shadow-sm">
      {editing
        ? <input
            autoFocus
            aria-label="Objectnaam"
            aria-invalid={!!error}
            disabled={busy}
            value={concept}
            onChange={event => { latest.current = event.target.value; setConcept(event.target.value); setError(''); }}
            onBlur={() => { void save(); }}
            onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); cancel(); }
              if (event.key === 'Enter') { event.preventDefault(); void save(); }
            }}
            className="block min-w-0 w-full rounded-lg border border-accent/60 bg-background px-2 py-1.5 text-2xl sm:text-3xl lg:text-[34px] font-semibold text-foreground leading-[1.1] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
        : <button
            type="button"
            aria-label="Wijzig objectnaam"
            title="Objectnaam direct wijzigen"
            disabled={busy}
            onClick={start}
            className="group inline-flex max-w-full min-w-0 items-start gap-2 rounded-lg px-1 py-1 -mx-1 text-left break-words transition-colors hover:bg-background/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60"
          >
            <span className="min-w-0 break-words">{object.titel}</span>
            <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </button>}
    </h1>
    {busy && <p role="status" className="mt-1 text-xs text-muted-foreground">Opslaan…</p>}
    {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
  </div>;
}
