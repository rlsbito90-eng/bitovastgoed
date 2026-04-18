import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { getMatchesForRelatieFromData, formatCurrency, formatDate } from '@/data/mock-data';
import { LeadStatusBadge, DealFaseBadge, MatchScoreBadge, PrioriteitBadge } from '@/components/StatusBadges';
import { ArrowLeft, Phone, Mail, Pencil, Trash2 } from 'lucide-react';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import ZoekprofielFormDialog from '@/components/forms/ZoekprofielFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 fade-in">
      <Link to="/relaties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Relaties
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{relatie.bedrijfsnaam}</h1>
            <LeadStatusBadge status={relatie.leadStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{relatie.contactpersoon} · {relatie.type}</p>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${relatie.telefoon}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <Phone className="h-4 w-4" /> Bel
          </a>
          <a href={`mailto:${relatie.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <Mail className="h-4 w-4" /> Mail
          </a>
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <Pencil className="h-4 w-4" /> Bewerken
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-destructive">
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

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Basisgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Telefoon</span><p className="text-foreground">{relatie.telefoon}</p></div>
              <div><span className="text-muted-foreground">E-mail</span><p className="text-foreground">{relatie.email}</p></div>
              <div><span className="text-muted-foreground">Regio</span><p className="text-foreground">{relatie.regio.join(', ')}</p></div>
              <div><span className="text-muted-foreground">Asset classes</span><p className="text-foreground capitalize">{relatie.assetClasses.join(', ')}</p></div>
              {relatie.budgetMin && (
                <div><span className="text-muted-foreground">Budget</span><p className="text-foreground font-mono-data">{formatCurrency(relatie.budgetMin)} – {formatCurrency(relatie.budgetMax)}</p></div>
              )}
              <div><span className="text-muted-foreground">Laatste contact</span><p className="text-foreground">{formatDate(relatie.laatsteContact)}</p></div>
            </div>
            {relatie.aankoopcriteria && (
              <div><span className="text-xs text-muted-foreground">Aankoopcriteria</span><p className="text-sm text-foreground mt-1">{relatie.aankoopcriteria}</p></div>
            )}
            {relatie.verkoopintentie && (
              <div><span className="text-xs text-muted-foreground">Verkoopintentie</span><p className="text-sm text-foreground mt-1">{relatie.verkoopintentie}</p></div>
            )}
            {relatie.notities && (
              <div><span className="text-xs text-muted-foreground">Notities</span><p className="text-sm text-foreground mt-1">{relatie.notities}</p></div>
            )}
          </div>

          {deals.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Gekoppelde deals ({deals.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {deals.map(deal => {
                  const obj = store.getObjectById(deal.objectId);
                  return (
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-foreground">{obj?.titel}</p>
                          <p className="text-xs text-muted-foreground">{obj?.plaats} · {formatCurrency(obj?.vraagprijs)}</p>
                        </div>
                        <DealFaseBadge fase={deal.fase} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {taken.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Open taken ({taken.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {taken.map(taak => (
                  <div key={taak.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{taak.titel}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(taak.deadline)}</p>
                    </div>
                    <PrioriteitBadge prioriteit={taak.prioriteit} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Zoekprofielen ({zoekprofielen.length})</h2>
              <button onClick={() => setZpOpen(true)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                <Plus className="h-3 w-3" /> Nieuw
              </button>
            </div>
            <div className="divide-y divide-border">
              {zoekprofielen.length === 0 && (
                <p className="px-5 py-4 text-xs text-muted-foreground">Nog geen zoekprofielen.</p>
              )}
              {zoekprofielen.map(zp => (
                <div key={zp.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-foreground">{zp.naam}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{zp.typeVastgoed.join(', ')} · {zp.regio.join(', ')}</p>
                  {zp.prijsMax && <p className="text-xs text-muted-foreground font-mono-data">{formatCurrency(zp.prijsMin)} – {formatCurrency(zp.prijsMax)}</p>}
                </div>
              ))}
            </div>
          </div>

          {matches.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Matchende objecten ({matches.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {matches.slice(0, 5).map((m, i) => {
                  const obj = store.getObjectById(m.objectId);
                  return (
                    <Link key={i} to={`/objecten/${m.objectId}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{obj?.titel}</p>
                          <p className="text-xs text-muted-foreground">{obj?.plaats}</p>
                        </div>
                        <MatchScoreBadge score={m.score} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <RelatieFormDialog open={editOpen} onOpenChange={setEditOpen} relatie={relatie} />
      <ZoekprofielFormDialog open={zpOpen} onOpenChange={setZpOpen} defaultRelatieId={relatie.id} />
    </div>
  );
}
