import { useState, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency, formatDate } from '@/data/mock-data';
import { DealFaseBadge, LeadStatusBadge, ObjectStatusBadge } from '@/components/StatusBadges';
import { ArrowLeft, Pencil, Trash2, Star } from 'lucide-react';
import DealFormDialog from '@/components/forms/DealFormDialog';
import DealObjectenSectie from '@/components/deal/DealObjectenSectie';
import DealKandidatenSectie from '@/components/deal/DealKandidatenSectie';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="field-label">{label}</p>
      <div className="text-sm text-foreground mt-1 break-words">{children}</div>
    </div>
  );
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const deal = store.getDealById(id!);
  const [editOpen, setEditOpen] = useState(false);

  if (!deal) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Deal niet gevonden.</p>
        <Link to="/deals" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar deals</Link>
      </div>
    );
  }

  const relatie = store.getRelatieById(deal.relatieId);
  const object = store.getObjectById(deal.objectId);

  const handleDelete = async () => {
    try {
      await store.deleteDeal(deal.id);
      toast.success('Deal verwijderd');
      navigate('/deals');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <div className="page-shell-narrow">
      <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Deals
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight">{object?.titel || 'Deal'}</h1>
            <DealFaseBadge fase={deal.fase} />
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 truncate">
            {relatie?.bedrijfsnaam} · {object?.plaats}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <Pencil className="h-4 w-4" /> Bewerken
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center justify-center px-2.5 py-2 text-sm border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-destructive" aria-label="Verwijderen">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deal verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>Weet je zeker dat je deze deal wilt verwijderen?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <section className="section-card p-5 sm:p-6 space-y-5">
            <h2 className="section-title">Dealgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Dealfase"><span className="capitalize">{deal.fase}</span></Field>
              <Field label="Interessegraad">
                <span className="inline-flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < deal.interessegraad ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                  ))}
                </span>
              </Field>
              <Field label="Eerste contact"><span className="tabular-nums">{formatDate(deal.datumEersteContact)}</span></Field>
              <Field label="Follow-up"><span className="tabular-nums">{deal.datumFollowUp ? formatDate(deal.datumFollowUp) : '—'}</span></Field>
              {deal.bezichtigingGepland && <Field label="Bezichtiging"><span className="tabular-nums">{formatDate(deal.bezichtigingGepland)}</span></Field>}
              {deal.indicatiefBod && <Field label="Indicatief bod"><span className="font-mono-data">{formatCurrency(deal.indicatiefBod)}</span></Field>}
            </div>
            {deal.notities && (
              <div className="hairline pt-5">
                <Field label="Notities">{deal.notities}</Field>
              </div>
            )}
          </section>

          {object && (
            <Link to={`/objecten/${object.id}`} className="block section-card p-5 sm:p-6 hover:border-accent/40 transition-colors">
              <div className="flex items-center justify-between mb-3 gap-3">
                <h2 className="section-title flex items-center gap-2">
                  Primair object <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                </h2>
                <ObjectStatusBadge status={object.status} />
              </div>
              <p className="text-foreground font-medium truncate">{object.titel}</p>
              <p className="text-sm text-muted-foreground truncate">{object.plaats}, {object.provincie}</p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Field label="Prijs"><span className="font-mono-data">{formatCurrency(object.vraagprijs)}</span></Field>
                <Field label="Oppervlakte"><span className="font-mono-data">{object.oppervlakte?.toLocaleString('nl-NL') ?? '—'} m²</span></Field>
              </div>
            </Link>
          )}

          <DealObjectenSectie dealId={deal.id} primairObjectId={deal.objectId} />
          <DealKandidatenSectie dealId={deal.id} primaireRelatieId={deal.relatieId} />
        </div>

        <div>
          {relatie && (
            <Link to={`/relaties/${relatie.id}`} className="block section-card p-5 sm:p-6 hover:border-accent/40 transition-colors space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title">Primaire relatie</h2>
                <LeadStatusBadge status={relatie.leadStatus} />
              </div>
              <div>
                <p className="text-foreground font-medium truncate">{relatie.bedrijfsnaam}</p>
                <p className="text-sm text-muted-foreground truncate">{relatie.contactpersoon}</p>
              </div>
              <div className="text-sm space-y-1 hairline pt-3">
                {relatie.telefoon && <p className="text-muted-foreground truncate">{relatie.telefoon}</p>}
                {relatie.email && <p className="text-muted-foreground truncate">{relatie.email}</p>}
                {relatie.budgetMax && (
                  <p className="font-mono-data text-muted-foreground pt-1">Budget: {formatCurrency(relatie.budgetMin)} – {formatCurrency(relatie.budgetMax)}</p>
                )}
              </div>
            </Link>
          )}
        </div>
      </div>

      <DealFormDialog open={editOpen} onOpenChange={setEditOpen} deal={deal} />
    </div>
  );
}
