// src/components/contactmoment/TimelineItem.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CONTACT_MOMENT_TYPE_LABELS,
  CONTACT_MOMENT_TYPE_ICON,
  CONTACT_MOMENT_DIRECTION_LABELS,
  formatMomentDateTime,
  type ContactMoment,
} from '@/lib/contactMoments';
import { useDataStore } from '@/hooks/useDataStore';
import { Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Cog } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';

interface Props {
  item: ContactMoment;
  onEdit: (item: ContactMoment) => void;
  /** Welke entiteit-context wordt hier al getoond? Niet als chip herhalen. */
  contextEntity?: 'relatie' | 'object' | 'deal' | 'acquisitie';
}

export default function TimelineItem({ item, onEdit, contextEntity }: Props) {
  const store = useDataStore();
  const [deleting, setDeleting] = useState(false);
  const Icon = CONTACT_MOMENT_TYPE_ICON[item.type] ?? CONTACT_MOMENT_TYPE_ICON.algemeen;

  const relatie = item.relatieId && contextEntity !== 'relatie' ? store.getRelatieById(item.relatieId) : null;
  const object = item.objectId && contextEntity !== 'object' ? store.getObjectById(item.objectId) : null;
  const deal = item.dealId && contextEntity !== 'deal' ? store.getDealById(item.dealId) : null;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await store.deleteContactMoment(item.id);
      toast.success('Tijdlijnitem verwijderd');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative pl-7 pr-1 py-2 group">
      {/* Tijdlijnlijn + bolletje */}
      <span className="absolute left-2 top-0 bottom-0 w-px bg-border" aria-hidden />
      <span
        className={`absolute left-[3px] top-3 h-3 w-3 rounded-full border-2 ${
          item.isSystem ? 'bg-muted border-muted-foreground/40' : 'bg-accent border-accent'
        }`}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{formatMomentDateTime(item.momentDate, item.momentTime)}</span>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1 text-foreground/80">
              <Icon className="h-3 w-3" />
              {CONTACT_MOMENT_TYPE_LABELS[item.type]}
            </span>
            {item.direction !== 'n_v_t' && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-0.5">
                  {item.direction === 'inkomend' && <ArrowDownLeft className="h-3 w-3" />}
                  {item.direction === 'uitgaand' && <ArrowUpRight className="h-3 w-3" />}
                  {CONTACT_MOMENT_DIRECTION_LABELS[item.direction]}
                </span>
              </>
            )}
            {item.isSystem && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                <Cog className="h-2.5 w-2.5" /> systeem
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-foreground break-words">{item.title}</p>

          {item.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{item.description}</p>
          )}

          {item.outcome && (
            <p className="text-xs text-foreground/80">
              <span className="text-muted-foreground">Uitkomst: </span>{item.outcome}
            </p>
          )}

          {(relatie || object || deal) && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {relatie && (
                <Link to={`/relaties/${relatie.id}`} className="text-[11px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 text-foreground/80 hover:text-foreground transition-colors truncate max-w-[200px]">
                  {getRelatieNaamCompact(relatie, store.contactpersonen)}
                </Link>
              )}
              {object && (
                <Link to={`/objecten/${object.id}`} className="text-[11px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 text-foreground/80 hover:text-foreground transition-colors truncate max-w-[200px]">
                  {object.titel}
                </Link>
              )}
              {deal && (
                <Link to={`/deals/${deal.id}`} className="text-[11px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 text-foreground/80 hover:text-foreground transition-colors">
                  Deal
                </Link>
              )}
            </div>
          )}

          {item.followUpRequired && (
            <p className="text-xs text-accent">
              Vervolgactie{item.followUpDate ? ` op ${new Date(item.followUpDate).toLocaleDateString('nl-NL')}` : ''}
            </p>
          )}
        </div>

        {!item.isSystem && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Bewerken"
              title="Bewerken"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  aria-label="Verwijderen"
                  title="Verwijderen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tijdlijnitem verwijderen?</AlertDialogTitle>
                  <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Verwijderen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
