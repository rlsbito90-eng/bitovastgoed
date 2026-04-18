import { useState, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { getMatchesForRelatieFromData, formatCurrency, formatDate } from '@/data/mock-data';
import { LeadStatusBadge, DealFaseBadge, MatchScoreBadge, PrioriteitBadge } from '@/components/StatusBadges';
import { ArrowLeft, Phone, Mail, Pencil, Trash2, Plus } from 'lucide-react';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import ZoekprofielFormDialog from '@/components/forms/ZoekprofielFormDialog';
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

export default function RelatieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const relatie = store.getRelatieById(id!);
  const [editOpen, setEditOpen] = useState(false);
  const [zpOpen, setZpOpen] = useState(false);

  if (!relatie) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Relatie niet gevonden.</p>
        <Link to="/relaties" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar relaties</Link>
      </div>
    );
  }

  const zoekprofielen = store.getZoekprofielenByRelatie(relatie.id);
  const deals = store.getDealsByRelatie(relatie.id);
  const taken = store.getTakenByRelatie(relatie.id);
  const matches = getMatchesForRelatieFromData(relatie.id, store.zoekprofielen, store.objecten);

  const handleDelete = async () => {
    try {
      await store.deleteRelatie(relatie.id);
      toast.success('Relatie verwijderd');
      navigate('/relaties');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <div className="page-shell-narrow">
      <Link to="/relaties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Relaties
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight">{relatie.bedrijfsnaam}</h1>
            <LeadStatusBadge status={relatie.leadStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">{relatie.contactpersoon} · <span className="capitalize">{relatie.type}</span></p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {relatie.telefoon && (
            <a href={`tel:${relatie.telefoon}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Phone className="h-4 w-4" /> Bel
            </a>
          )}
          {relatie.email && (
            <a href={`mailto:${relatie.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Mail className="h-4 w-4" /> Mail
            </a>
          )}
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
                <AlertDialogTitle>Relatie verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>Weet je zeker dat je {relatie.bedrijfsnaam} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
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
            <h2 className="section-title">Basisgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Telefoon">{relatie.telefoon || '—'}</Field>
              <Field label="E-mail">{relatie.email || '—'}</Field>
              <Field label="Regio">{relatie.regio.length ? relatie.regio.join(', ') : '—'}</Field>
              <Field label="Asset classes"><span className="capitalize">{relatie.assetClasses.length ? relatie.assetClasses.join(', ') : '—'}</span></Field>
              {relatie.budgetMin && (
                <Field label="Budget"><span className="font-mono-data">{formatCurrency(relatie.budgetMin)} – {formatCurrency(relatie.budgetMax)}</span></Field>
              )}
              <Field label="Laatste contact"><span className="tabular-nums">{formatDate(relatie.laatsteContact)}</span></Field>
            </div>

            {(relatie.aankoopcriteria || relatie.verkoopintentie || relatie.notities) && (
              <div className="space-y-4 hairline pt-5">
                {relatie.aankoopcriteria && <Field label="Aankoopcriteria">{relatie.aankoopcriteria}</Field>}
                {relatie.verkoopintentie && <Field label="Verkoopintentie">{relatie.verkoopintentie}</Field>}
                {relatie.notities && <Field label="Notities">{relatie.notities}</Field>}
              </div>
            )}
          </section>

          {deals.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Gekoppelde deals ({deals.length})</h2></header>
              <div className="divide-y divide-border/70">
                {deals.map(deal => {
                  const obj = store.getObjectById(deal.objectId);
                  return (
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{obj?.titel}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{obj?.plaats} · <span className="font-mono-data">{formatCurrency(obj?.vraagprijs)}</span></p>
                        </div>
                        <DealFaseBadge fase={deal.fase} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {taken.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Open taken ({taken.length})</h2></header>
              <div className="divide-y divide-border/70">
                {taken.map(taak => (
                  <div key={taak.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{taak.titel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{formatDate(taak.deadline)}</p>
                    </div>
                    <PrioriteitBadge prioriteit={taak.prioriteit} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4 lg:space-y-6">
          <section className="section-card">
            <header className="section-header">
              <h2 className="section-title">Zoekprofielen ({zoekprofielen.length})</h2>
              <button onClick={() => setZpOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80">
                <Plus className="h-3 w-3" /> Nieuw
              </button>
            </header>
            <div className="divide-y divide-border/70">
              {zoekprofielen.length === 0 && (
                <p className="px-5 py-6 text-xs text-muted-foreground">Nog geen zoekprofielen.</p>
              )}
              {zoekprofielen.map(zp => (
                <div key={zp.id} className="px-5 py-3.5">
                  <p className="text-sm font-medium text-foreground truncate">{zp.naam}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize truncate">{zp.typeVastgoed.join(', ')} · {zp.regio.join(', ') || '—'}</p>
                  {zp.prijsMax && <p className="text-xs text-muted-foreground font-mono-data mt-0.5">{formatCurrency(zp.prijsMin)} – {formatCurrency(zp.prijsMax)}</p>}
                </div>
              ))}
            </div>
          </section>

          {matches.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Matchende objecten ({matches.length})</h2></header>
              <div className="divide-y divide-border/70">
                {matches.slice(0, 5).map((m, i) => {
                  const obj = store.getObjectById(m.objectId);
                  return (
                    <Link key={i} to={`/objecten/${m.objectId}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{obj?.titel}</p>
                          <p className="text-xs text-muted-foreground truncate">{obj?.plaats}</p>
                        </div>
                        <MatchScoreBadge score={m.score} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      <RelatieFormDialog open={editOpen} onOpenChange={setEditOpen} relatie={relatie} />
      <ZoekprofielFormDialog open={zpOpen} onOpenChange={setZpOpen} defaultRelatieId={relatie.id} />
    </div>
  );
}
