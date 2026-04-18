import { useState, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { getMatchesForObjectFromData, formatCurrency, formatDate } from '@/data/mock-data';
import { ObjectStatusBadge, DealFaseBadge, MatchScoreBadge } from '@/components/StatusBadges';
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react';
import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
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

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`relative section-card p-4 sm:p-5 overflow-hidden ${accent ? 'accent-rule' : ''}`}>
      <p className="field-label">{label}</p>
      <p className="text-xl lg:text-2xl font-semibold font-mono-data text-foreground mt-1.5 truncate">{value}</p>
    </div>
  );
}

export default function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const object = store.getObjectById(id!);
  const [editOpen, setEditOpen] = useState(false);

  if (!object) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Object niet gevonden.</p>
        <Link to="/objecten" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar objecten</Link>
      </div>
    );
  }

  const deals = store.getDealsByObject(object.id);
  const matches = getMatchesForObjectFromData(object, store.zoekprofielen);
  const rendement = object.huurinkomsten && object.vraagprijs ? ((object.huurinkomsten / object.vraagprijs) * 100).toFixed(1) : null;
  const huurPerM2 = object.huurinkomsten && object.oppervlakte ? Math.round(object.huurinkomsten / object.oppervlakte) : null;

  const handleDelete = async () => {
    try {
      await store.deleteObject(object.id);
      toast.success('Object verwijderd');
      navigate('/objecten');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <div className="page-shell-narrow">
      <Link to="/objecten" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Objecten
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight">{object.titel}</h1>
            <ObjectStatusBadge status={object.status} />
            {object.exclusief && (
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-accent/30 text-accent rounded-full bg-accent/10">
                Exclusief
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {object.plaats}, {object.provincie} · <span className="capitalize">{object.type}</span>
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
                <AlertDialogTitle>Object verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>Weet je zeker dat je {object.titel} wilt verwijderen?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatTile label="Vraagprijs" value={formatCurrency(object.vraagprijs)} accent />
        <StatTile label="Oppervlakte" value={object.oppervlakte ? `${object.oppervlakte.toLocaleString('nl-NL')} m²` : '—'} />
        <StatTile label="BAR" value={rendement ? `${rendement}%` : '—'} />
        <StatTile label="Huur / m²" value={huurPerM2 ? `€${huurPerM2}` : '—'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <section className="section-card p-5 sm:p-6 space-y-5">
            <h2 className="section-title">Objectgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Huurinkomsten"><span className="font-mono-data">{formatCurrency(object.huurinkomsten)}</span> /jr</Field>
              <Field label="Aantal huurders">{object.aantalHuurders ?? '—'}</Field>
              <Field label="Verhuurstatus"><span className="capitalize">{object.verhuurStatus}</span></Field>
              <Field label="Bouwjaar"><span className="tabular-nums">{object.bouwjaar ?? '—'}</span></Field>
              <Field label="Onderhoudsstaat">{object.onderhoudsstaat ?? '—'}</Field>
              <Field label="Bron">{object.bron ?? '—'}</Field>
              <Field label="Ontwikkelpotentie">{object.ontwikkelPotentie ? 'Ja' : 'Nee'}</Field>
              <Field label="Transformatiepotentie">{object.transformatiePotentie ? 'Ja' : 'Nee'}</Field>
              <Field label="Documenten">{object.documentenBeschikbaar ? 'Beschikbaar' : 'Niet beschikbaar'}</Field>
              <Field label="Toegevoegd"><span className="tabular-nums">{formatDate(object.datumToegevoegd)}</span></Field>
            </div>

            {(object.samenvatting || object.interneOpmerkingen) && (
              <div className="space-y-4 hairline pt-5">
                {object.samenvatting && <Field label="Samenvatting">{object.samenvatting}</Field>}
                {object.interneOpmerkingen && (
                  <div className="bg-warning/5 border border-warning/20 rounded-md p-3.5">
                    <p className="field-label text-warning">Interne opmerking</p>
                    <p className="text-sm text-foreground mt-1">{object.interneOpmerkingen}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {deals.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Gekoppelde deals ({deals.length})</h2></header>
              <div className="divide-y divide-border/70">
                {deals.map(deal => {
                  const rel = store.getRelatieById(deal.relatieId);
                  return (
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{rel?.bedrijfsnaam}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{rel?.contactpersoon}</p>
                        </div>
                        <DealFaseBadge fase={deal.fase} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="section-card">
            <header className="section-header"><h2 className="section-title">Top kandidaten ({matches.length})</h2></header>
            <div className="divide-y divide-border/70">
              {matches.length === 0 && (
                <p className="px-5 py-6 text-sm text-muted-foreground">Geen matches gevonden.</p>
              )}
              {matches.slice(0, 10).map((m, i) => {
                const rel = store.getRelatieById(m.relatieId);
                return (
                  <Link key={i} to={`/relaties/${m.relatieId}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-sm font-medium text-foreground truncate">{rel?.bedrijfsnaam}</p>
                      <MatchScoreBadge score={m.score} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.redenen.slice(0, 2).join(' · ')}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <ObjectFormDialog open={editOpen} onOpenChange={setEditOpen} object={object} />
    </div>
  );
}
